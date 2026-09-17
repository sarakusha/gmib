import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';

import type { RemoteAuthCredentials } from '/@common/helpers';

import localConfig from './localConfig';

const DEFAULT_REMOTE_PASSWORD = 'nata-info';

const isCredentialString = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value);

const isRemoteAuthCredentials = (value: unknown): value is RemoteAuthCredentials => {
  if (!value || typeof value !== 'object') return false;
  const credentials = value as Partial<RemoteAuthCredentials>;
  return (
    isCredentialString(credentials.salt) &&
    isCredentialString(credentials.verifier) &&
    Number.isSafeInteger(credentials.revision) &&
    (credentials.revision ?? -1) >= 0
  );
};

const persistRemoteAuthCredentials = (credentials: RemoteAuthCredentials): void => {
  localConfig.store = {
    ...localConfig.store,
    remoteAuth: credentials,
    // Keep these fields synchronized so a downgrade does not silently restore an older password.
    salt: credentials.salt,
    verifier: credentials.verifier,
  };
};

const initializeRemoteAuthCredentials = async (): Promise<RemoteAuthCredentials> => {
  const current = localConfig.get('remoteAuth');
  if (isRemoteAuthCredentials(current)) return current;

  const salt = localConfig.get('salt');
  const verifier = localConfig.get('verifier');
  if (isCredentialString(salt) && isCredentialString(verifier)) {
    const migrated = { salt, verifier, revision: 0 };
    persistRemoteAuthCredentials(migrated);
    return migrated;
  }

  const routines = new SRPRoutines(new SRPParameters());
  const generated = await createVerifierAndSalt(routines, 'gmib', DEFAULT_REMOTE_PASSWORD);
  const created = {
    salt: `0x${generated.s.toString(16)}`,
    verifier: `0x${generated.v.toString(16)}`,
    revision: 0,
  };
  persistRemoteAuthCredentials(created);
  return created;
};

let credentialsPromise = initializeRemoteAuthCredentials();

export const getRemoteAuthCredentials = (): Promise<RemoteAuthCredentials> => credentialsPromise;

export const setRemoteAuthCredentials = (credentials: RemoteAuthCredentials): Promise<void> => {
  return Promise.resolve().then(() => {
    persistRemoteAuthCredentials(credentials);
    credentialsPromise = Promise.resolve(credentials);
  });
};
