import type { LicenseRuntimeState, SignedLicense } from '/@common/license';

type ClientMetadata = {
  name: string;
  os: string;
  version: string;
};

type ActivationInput = ClientMetadata & {
  key: string;
  deviceId: string;
};

const isSignedLicense = (value: unknown): value is SignedLicense =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'payload') === 'string' &&
  typeof Reflect.get(value, 'signature') === 'string';

const request = async (path: string, body: unknown): Promise<SignedLicense> => {
  const response = await fetch(`${import.meta.env.VITE_LICENSE_SERVER}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const message = await response.text();
    throw Object.assign(new Error(message || response.statusText), { status: response.status });
  }
  const value: unknown = await response.json();
  const license =
    typeof value === 'object' && value !== null ? Reflect.get(value, 'license') : undefined;
  if (!isSignedLicense(license)) throw new Error('License server returned an invalid response');
  return license;
};

export const requestLicenseActivation = (input: ActivationInput): Promise<SignedLicense> =>
  request('/api/v2/licenses/activate', input);

export const requestLicenseRefresh = (
  license: SignedLicense,
  metadata: ClientMetadata,
): Promise<SignedLicense> => request('/api/v2/licenses/refresh', { license, ...metadata });

export const accessDeniedMessage = (state: LicenseRuntimeState): string =>
  state.status === 'active'
    ? 'Функция доступна в лицензии Plus или выше'
    : state.message || 'Требуется действующая лицензия';

