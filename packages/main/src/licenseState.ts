import os from 'node:os';

import debugFactory from 'debug';

import type { LicensePayloadV2, LicenseRuntimeState, SignedLicense } from '/@common/license';

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

const scheduleRefresh = (document: SignedLicense): void => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshStoredLicense(localConfig.get('signedLicense') ?? document)
      .then(payload => {
        debug(`refreshed status: ${payload.status}`);
        if (sessionPayload && sessionTermsChanged(sessionPayload, payload)) {
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
      .finally(() => {
        const current = localConfig.get('signedLicense');
        if (current) scheduleRefresh(current);
      });
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
};

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
  const document = localConfig.get('signedLicense');
  try {
    let payload: LicensePayloadV2 | undefined;
    if (document) {
      payload = await verifyDocument(document);
      const initial = getPayloadRuntimeState(payload);
      if (shouldRefreshStoredLicense(initial)) {
        try {
          payload = await refreshStoredLicense(document);
        } catch (error) {
          debug(`inactive license refresh failed: ${(error as Error).message}`);
        }
      }
    } else {
      try {
        payload = await activateLegacyLicense();
      } catch (error) {
        state = {
          status: 'migration-required',
          capabilities: [],
          message: (error as Error).message,
        };
        return state;
      }
    }
    if (!payload) {
      state = { status: 'unlicensed', capabilities: [] };
      return state;
    }
    state = getPayloadRuntimeState(payload);
    if (state.status === 'active') {
      sessionPayload = payload;
      scheduleRefresh(localConfig.get('signedLicense')!);
    }
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

export const retryLicense = (): Promise<LicenseRetryResult> => {
  if (sessionPayload) {
    return Promise.resolve({ state: getLicenseState(), relaunchRequired: false });
  }
  if (retryPromise) return retryPromise;
  retryPromise = bootstrapLicense()
    .then(nextState => ({
      state: nextState,
      relaunchRequired: nextState.status === 'active',
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
  sessionPayload !== undefined && allowsCapability(sessionPayload, capability);

export const requireLicenseCapability = (capability: string): void => {
  if (!hasLicenseCapability(capability)) {
    throw Object.assign(new Error(accessDeniedMessage(state)), { status: 403 });
  }
};
