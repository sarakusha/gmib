import os from 'node:os';

import debugFactory from 'debug';

import type { LicensePayloadV2, LicenseRuntimeState, SignedLicense } from '/@common/license';

import { decodeLegacyLicense } from './legacyLicense';
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

const metadata = () => ({
  name: os.hostname().replace(/\.local$/, ''),
  os: os.version(),
  version: import.meta.env.VITE_APP_VERSION,
});

const publicKeys = () => parsePublicKeys(import.meta.env.VITE_LICENSE_PUBLIC_KEYS);

const payloadState = (payload: LicensePayloadV2, now = Date.now()): LicenseRuntimeState => {
  const locallyExpired = payload.expiresAt !== null && now >= Date.parse(payload.expiresAt);
  const payloadStatus = locallyExpired && payload.status === 'active' ? 'expired' : payload.status;
  const status = payloadStatus === 'unbound' ? 'unlicensed' : payloadStatus;
  return {
    status,
    plan: payload.plan,
    expiresAt: payload.expiresAt,
    capabilities: payload.capabilities,
  };
};

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
  state = { status: 'checking', capabilities: [] };
  sessionPayload = undefined;
  const document = localConfig.get('signedLicense');
  try {
    let payload: LicensePayloadV2 | undefined;
    if (document) {
      payload = await verifyDocument(document);
      const initial = payloadState(payload);
      if (initial.status === 'expired') {
        try {
          payload = await refreshStoredLicense(document);
        } catch (error) {
          debug(`expired license refresh failed: ${(error as Error).message}`);
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
    state = payloadState(payload);
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

export const getLicenseState = (): LicenseRuntimeState => ({ ...state });

export const hasLicenseCapability = (capability: string): boolean =>
  sessionPayload !== undefined && allowsCapability(sessionPayload, capability);

export const requireLicenseCapability = (capability: string): void => {
  if (!hasLicenseCapability(capability)) {
    throw Object.assign(new Error(accessDeniedMessage(state)), { status: 403 });
  }
};
