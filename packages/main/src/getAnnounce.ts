import { randomBytes } from 'node:crypto';

import authRequest from './authRequest';
import { decodeLegacyLicense } from './legacyLicense';
import { getPayloadRuntimeState } from './licenseLifecycle';
import { getLicensePresentation } from './licensePresentation';
import { verifyLicenseSessionAssertion } from './licenseSessionAssertion';
import { parsePublicKeys, verifyLicense } from './licenseVerification';
import { getRemoteCredentials } from './secret';

import type { LicensePayloadV2, LicenseRuntimeState } from '/@common/license';

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

const activeSessionState = (payload: LicensePayloadV2): LicenseRuntimeState => ({
  status: 'active',
  plan: payload.plan,
  expiresAt: payload.expiresAt,
  capabilities: payload.capabilities,
});

const getAnnounce = async (host?: string, port?: number): Promise<AnnounceResponse | undefined> => {
  const challenge = randomBytes(32).toString('base64url');
  const res = await authRequest({
    host,
    port,
    api: 'announce',
    headers: { 'x-ni-license-session-challenge': challenge },
  });
  if (!res?.ok) return undefined;
  const response = (await res.json()) as AnnounceResponse;
  const { announce, iv, key, ...data } = response;
  const result: AnnounceResponse = { machineId: key, ...data };
  const parsed = announce && iv && key ? decodeLegacyLicense({ announce, iv }, key) : undefined;
  const combined = parsed ? { ...parsed, ...result } : result;
  const {
    plan: _,
    renew: __,
    message: ___,
    useProxy: ____,
    licenseSession: _____,
    ...session
  } = combined;
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
    const document = response.license;
    const payload = verifyLicense(
      document,
      key,
      parsePublicKeys(import.meta.env.VITE_LICENSE_PUBLIC_KEYS),
    );
    const baseUrl = `http://${host ?? 'localhost'}:${port ?? Number(process.env['NIBUS_PORT'] ?? 9001) + 1}/api`;
    const credentials =
      payload.status === 'active' ? await getRemoteCredentials(`${baseUrl}/identifier`) : undefined;
    const activeSession =
      payload.status === 'active' &&
      credentials?.apiSecret !== undefined &&
      verifyLicenseSessionAssertion(
        response.licenseSession,
        document as { payload: string; signature: string },
        challenge,
        credentials.apiSecret,
      );
    const localState = getPayloadRuntimeState(payload);
    const licenseState = activeSession
      ? activeSessionState(payload)
      : localState.status === 'active'
        ? invalidRemoteState('Не удалось подтвердить активную сессию удалённого GMIB')
        : { ...localState, capabilities: [] };
    return {
      ...session,
      licenseState,
      ...getLicensePresentation(activeSession ? payload : undefined),
    };
  } catch (error) {
    return {
      ...session,
      licenseState: invalidRemoteState((error as Error).message),
    };
  }
};

export default getAnnounce;
