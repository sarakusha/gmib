import debugFactory from 'debug';

import type { SignedLicense } from '/@common/license';

import { applyLegacyLicenseUpdate, parseLegacyLicenseUpdate } from './legacyLicenseStorage';
import { requestLicenseActivation } from './licenseClient';
import { saveActiveLicenseDocument } from './licenseState';
import localConfig from './localConfig';

type ActivationInput = {
  key: string;
  name: string;
  deviceId: string;
  version: string;
  os: string;
};

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:activation`);

const readWithSignal = async <T>(body: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw signal.reason;
  let rejectAbort: (reason?: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort(signal.reason);
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.race([body, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
};

const updateLegacyFields = async (input: ActivationInput, signal: AbortSignal): Promise<void> => {
  const response = await fetch(`${import.meta.env.VITE_LICENSE_SERVER}/api/licenses`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    const message = await readWithSignal(response.text(), signal);
    throw new Error(`${response.statusText} - ${message}`);
  }
  const value = await readWithSignal(response.json(), signal);
  const legacy = parseLegacyLicenseUpdate(value);
  if (typeof legacy.announce !== 'string' || typeof legacy.iv !== 'string') {
    throw new Error('License server returned an invalid compatibility response');
  }
  applyLegacyLicenseUpdate(localConfig, legacy);
};

export const completeLicenseActivation = async (
  input: ActivationInput,
  signal: AbortSignal,
): Promise<SignedLicense> => {
  const document = await requestLicenseActivation(input, signal);
  await saveActiveLicenseDocument(document);
  try {
    await updateLegacyFields(input, signal);
  } catch (error) {
    debug(`compatibility update failed: ${(error as Error).message}`);
  }
  return document;
};
