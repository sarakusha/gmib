import os from 'node:os';

import debugFactory from 'debug';

import {
  type LicensePayloadV2,
  type LicensePlan,
  licensePlans,
  type LicenseRuntimeState,
  type SignedLicense,
} from '/@common/license';

import { getLicensePresentation, type LicensePresentation } from './licensePresentation';

import { decodeLegacyLicense } from './legacyLicense';
import {
  getPayloadRuntimeState,
  sessionTermsChanged,
  shouldRefreshStoredLicense,
} from './licenseLifecycle';
import {
  accessDeniedMessage,
  requestLicenseActivation,
  requestLicenseRefresh,
} from './licenseClient';
import { allowsCapability, parsePublicKeys, verifyLicense } from './licenseVerification';
import localConfig from './localConfig';
import machineIdPromise from './machineId';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:runtime-state`);
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

let state: LicenseRuntimeState = { status: 'checking', capabilities: [] };
let sessionPayload: LicensePayloadV2 | undefined;
let sessionDocument: SignedLicense | undefined;
let announcedDocument: SignedLicense | undefined;
let legacyPresentation: LicensePresentation | undefined;
let checkPromise: Promise<LicensePayloadV2 | undefined> | undefined;
let refreshTimer: NodeJS.Timeout | undefined;
let retryPromise: Promise<LicenseRetryResult> | undefined;
const stateListeners = new Set<(nextState: LicenseRuntimeState) => void>();

export type LicenseRetryResult = {
  state: LicenseRuntimeState;
  relaunchRequired: boolean;
};

const metadata = () => ({
  name: os.hostname().replace(/\.local$/, ''),
  os: os.version(),
  version: import.meta.env.VITE_APP_VERSION,
});

const publicKeys = () => parsePublicKeys(import.meta.env.VITE_LICENSE_PUBLIC_KEYS);

const verifyDocument = async (document: unknown): Promise<LicensePayloadV2> =>
  verifyLicense(document, await machineIdPromise, publicKeys());

const saveVerifiedDocument = async (document: SignedLicense): Promise<LicensePayloadV2> => {
  const payload = await verifyDocument(document);
  localConfig.set('signedLicense', document);
  return payload;
};

const refreshStoredLicense = async (document: SignedLicense): Promise<LicensePayloadV2> => {
  const refreshed = await requestLicenseRefresh(document, metadata());
  return saveVerifiedDocument(refreshed);
};

// Serialize automatic checks and explicit retries. A network error never changes
// the locally verified session or replaces its stored activation.
const checkStoredLicense = (): Promise<LicensePayloadV2 | undefined> => {
  if (checkPromise) return checkPromise;
  const document = localConfig.get('signedLicense');
  checkPromise = (document ? refreshStoredLicense(document) : activateLegacyLicense()).finally(
    () => {
      checkPromise = undefined;
    },
  );
  return checkPromise;
};

const scheduleRefresh = (delay = REFRESH_INTERVAL_MS): void => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void checkStoredLicense()
      .then(payload => {
        if (!payload) return;
        const nextState = getPayloadRuntimeState(payload);
        if (
          legacyPresentation ||
          nextState.status !== state.status ||
          (sessionPayload && sessionTermsChanged(sessionPayload, payload))
        ) {
          state = {
            ...state,
            restartRequired: true,
            message: 'Условия лицензии изменились. Перезапустите GMIB, чтобы применить их.',
          };
          stateListeners.forEach(listener => listener(getLicenseState()));
        }
      })
      .catch(error => {
        debug(`refresh failed: ${(error as Error).message}`);
      })
      .finally(() => scheduleRefresh());
  }, delay);
  refreshTimer.unref();
};

const readLegacyLicense = async () =>
  decodeLegacyLicense(
    { announce: localConfig.get('announce'), iv: localConfig.get('iv') },
    await machineIdPromise,
  );

const activateLegacyLicense = async (): Promise<LicensePayloadV2 | undefined> => {
  const deviceId = await machineIdPromise;
  const legacy = decodeLegacyLicense(
    { announce: localConfig.get('announce'), iv: localConfig.get('iv') },
    deviceId,
  );
  if (!legacy?.key || typeof legacy.key !== 'string') return undefined;
  const document = await requestLicenseActivation({
    ...metadata(),
    deviceId,
    key: legacy.key,
  });
  return saveVerifiedDocument(document);
};

export const bootstrapLicense = async (): Promise<LicenseRuntimeState> => {
  clearTimeout(refreshTimer);
  state = { status: 'checking', capabilities: [] };
  sessionPayload = undefined;
  sessionDocument = undefined;
  announcedDocument = undefined;
  legacyPresentation = undefined;
  const document = localConfig.get('signedLicense');
  try {
    if (document) {
      const payload = await verifyDocument(document);
      announcedDocument = document;
      state = getPayloadRuntimeState(payload);
      if (state.status === 'active') {
        sessionPayload = payload;
        sessionDocument = document;
      }
      // Even renewal of an expired document must not hold up the base runtime.
      scheduleRefresh(shouldRefreshStoredLicense(state) ? 0 : REFRESH_INTERVAL_MS);
      return state;
    }

    const legacy = await readLegacyLicense();
    if (!legacy || typeof legacy.key !== 'string' || !legacy.key) {
      state = { status: 'unlicensed', capabilities: [] };
      return state;
    }
    const plan = licensePlans.includes(legacy.plan as LicensePlan)
      ? (legacy.plan as LicensePlan)
      : undefined;
    const expiresAt = typeof legacy.renew === 'string' ? legacy.renew : undefined;
    const validExpiry =
      legacy.renew == null || (expiresAt !== undefined && Number.isFinite(Date.parse(expiresAt)));
    const expired = expiresAt !== undefined && Date.now() >= Date.parse(expiresAt);
    if (!plan || !validExpiry) {
      state = { status: 'migration-required', capabilities: [] };
    } else if (expired) {
      state = { status: 'expired', plan, expiresAt, capabilities: [] };
    } else {
      // Preserve the previous activation until its signed replacement is available.
      // Do not invent capabilities that were absent from the legacy protocol.
      state = {
        status: 'active',
        plan,
        expiresAt,
        capabilities: legacy.useProxy === true ? ['novastar'] : [],
      };
      legacyPresentation = {
        plan,
        ...(expiresAt && { renew: expiresAt }),
        ...(typeof legacy.message === 'string' && { message: legacy.message }),
        useProxy: legacy.useProxy === true,
      };
    }
    scheduleRefresh(0);
    return state;
  } catch (error) {
    state = {
      status: document ? 'invalid' : 'migration-required',
      capabilities: [],
      message: (error as Error).message,
    };
    return state;
  }
};

export const verifyLicenseDocument = (document: SignedLicense): Promise<LicensePayloadV2> =>
  verifyDocument(document);

export const saveActiveLicenseDocument = async (
  document: SignedLicense,
): Promise<LicensePayloadV2> => {
  const payload = await verifyDocument(document);
  if (payload.status !== 'active') throw new Error(`License is ${payload.status}`);
  localConfig.set('signedLicense', document);
  return payload;
};

export const getLicenseState = (): LicenseRuntimeState => ({ ...state });

export const getSessionLicensePayload = (): LicensePayloadV2 | undefined => sessionPayload;

export const getSessionLicenseDocument = (): SignedLicense | undefined => sessionDocument;

export const getAnnouncedLicenseDocument = (): SignedLicense | undefined => announcedDocument;

export const getSessionLicensePresentation = (): LicensePresentation =>
  legacyPresentation ?? getLicensePresentation(sessionPayload);

export const hasLegacyLicenseSession = (): boolean => legacyPresentation !== undefined;

export const retryLicense = (): Promise<LicenseRetryResult> => {
  if (sessionPayload || legacyPresentation) {
    return Promise.resolve({ state: getLicenseState(), relaunchRequired: false });
  }
  if (retryPromise) return retryPromise;
  retryPromise = checkStoredLicense()
    .then(() => bootstrapLicense())
    .then(nextState => ({
      state: nextState,
      relaunchRequired: nextState.status === 'active',
    }))
    .catch(error => ({
      state: { ...getLicenseState(), message: (error as Error).message },
      relaunchRequired: false,
    }))
    .finally(() => {
      retryPromise = undefined;
    });
  return retryPromise;
};

export const onLicenseStateChange = (
  listener: (nextState: LicenseRuntimeState) => void,
): (() => void) => {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
};

export const hasLicenseCapability = (capability: string): boolean =>
  sessionPayload !== undefined
    ? allowsCapability(sessionPayload, capability)
    : legacyPresentation !== undefined && state.capabilities.includes(capability);

export const requireLicenseCapability = (capability: string): void => {
  if (!hasLicenseCapability(capability)) {
    throw Object.assign(new Error(accessDeniedMessage(state)), { status: 403 });
  }
};
