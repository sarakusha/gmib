import authRequest from './authRequest';
import { decodeLegacyLicense } from './legacyLicense';
import { getPayloadRuntimeState } from './licenseLifecycle';
import { getLicensePresentation } from './licensePresentation';
import { parsePublicKeys, verifyLicense } from './licenseVerification';

import type { LicenseRuntimeState } from '/@common/license';

type AnnounceResponse = {
  announce?: string;
  iv?: string;
  key?: string;
  machineId?: string;
  [k: string]: unknown;
};

const invalidRemoteState = (message: string): LicenseRuntimeState => ({
  status: 'invalid',
  capabilities: [],
  message,
});

const getAnnounce = async (host?: string, port?: number): Promise<AnnounceResponse | undefined> => {
  const res = await authRequest({ host, port, api: 'announce' });
  if (!res?.ok) return undefined;
  const response = (await res.json()) as AnnounceResponse;
  const { announce, iv, key, ...data } = response;
  const result: AnnounceResponse = { machineId: key, ...data };
  const parsed = announce && iv && key ? decodeLegacyLicense({ announce, iv }, key) : undefined;
  const combined = parsed ? { ...parsed, ...result } : result;
  const { plan: _, renew: __, message: ___, useProxy: ____, ...session } = combined;
  if (response.licenseProtocol === undefined) return combined;
  if (response.licenseProtocol !== 2 || !key) {
    return {
      ...session,
      licenseState: invalidRemoteState(
        'Удалённый GMIB использует неподдерживаемый формат лицензии',
      ),
    };
  }
  try {
    const payload = verifyLicense(
      response.license,
      key,
      parsePublicKeys(import.meta.env.VITE_LICENSE_PUBLIC_KEYS),
    );
    const licenseState = getPayloadRuntimeState(payload);
    return {
      ...session,
      licenseState,
      ...getLicensePresentation(licenseState.status === 'active' ? payload : undefined),
    };
  } catch (error) {
    return {
      ...session,
      licenseState: invalidRemoteState((error as Error).message),
    };
  }
};

export default getAnnounce;
