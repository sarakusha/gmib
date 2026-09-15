import authRequest from './authRequest';
import { decodeLegacyLicense } from './legacyLicense';
import { createLicensePresentation } from './licensePresentation';

import {
  licensePlans,
  type LicenseRuntimeState,
  type LicenseRuntimeStatus,
} from '/@common/license';

type AnnounceResponse = {
  announce?: string;
  iv?: string;
  key?: string;
  machineId?: string;
  [k: string]: unknown;
};

const runtimeStatuses: ReadonlySet<LicenseRuntimeStatus> = new Set([
  'checking',
  'migration-required',
  'active',
  'expired',
  'disabled',
  'invalid',
  'unlicensed',
]);

const getRemoteRuntimeState = (response: AnnounceResponse): LicenseRuntimeState | undefined => {
  if (response.licenseProtocol !== 2) return undefined;
  const value = response.licenseState;
  if (typeof value !== 'object' || value === null) return undefined;
  const status = Reflect.get(value, 'status');
  const plan = Reflect.get(value, 'plan');
  const capabilities = Reflect.get(value, 'capabilities');
  const expiresAt = Reflect.get(value, 'expiresAt');
  if (
    typeof status !== 'string' ||
    !runtimeStatuses.has(status as LicenseRuntimeStatus) ||
    !Array.isArray(capabilities) ||
    capabilities.some(capability => typeof capability !== 'string') ||
    (status === 'active' && !licensePlans.includes(plan)) ||
    (expiresAt !== undefined && expiresAt !== null && typeof expiresAt !== 'string')
  )
    return undefined;
  return {
    status: status as LicenseRuntimeStatus,
    capabilities,
    ...(licensePlans.includes(plan) && { plan }),
    ...(expiresAt === null || typeof expiresAt === 'string' ? { expiresAt } : {}),
  };
};

const getAnnounce = async (host?: string, port?: number): Promise<AnnounceResponse | undefined> => {
  const res = await authRequest({ host, port, api: 'announce' });
  if (!res?.ok) return undefined;
  const response = (await res.json()) as AnnounceResponse;
  const { announce, iv, key, ...data } = response;
  const result: AnnounceResponse = { machineId: key, ...data };
  const parsed = announce && iv && key ? decodeLegacyLicense({ announce, iv }, key) : undefined;
  const combined = parsed ? { ...parsed, ...result } : result;
  const runtimeState = getRemoteRuntimeState(response);
  if (!runtimeState || !key) return combined;
  const { plan: _, renew: __, message: ___, useProxy: ____, ...session } = combined;
  return { ...session, ...createLicensePresentation(runtimeState, key) };
};

export default getAnnounce;
