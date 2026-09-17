import { randomBytes } from 'crypto';
import { app, ipcMain } from 'electron';

import debugFactory from 'debug';

import type { NullableOptional } from '/@common/helpers';
import type { Credentials } from '/@common/Credentials';
import { srpSessionKeyToBuffer } from '/@common/srp';

import { promisifyGet, promisifyRun, removeNull } from './db';
import localConfig from './localConfig';
import { getRemoteAuthCredentials } from './remoteAuthConfig';

export type Secret = {
  id: string;
  secret: Buffer;
  created?: Date;
  revision: number;
};

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:secret`);

const isecrets = new Map<string, Buffer>();
const osecrets = new Map<string, Buffer>();

const decodeIncomingSecret = (value: string): { secret: Buffer; revision: number } => {
  const match = value.match(/^v1:(\d+):(.+)$/);
  if (!match) return { secret: Buffer.from(value, 'base64'), revision: 0 };
  return { secret: Buffer.from(match[2], 'base64'), revision: Number(match[1]) };
};

const toSecret = (res: NullableOptional): Secret => {
  const { id, secret, created } = removeNull(res) as {
    id: string;
    secret: string;
    created?: string;
  };
  const decoded = decodeIncomingSecret(secret);
  return {
    id,
    ...decoded,
    ...(created && { created: new Date(created) }),
  };
};

const getIncomingSecretImpl = promisifyGet(
  'SELECT * FROM isecret WHERE id = ?',
  (id: string) => id,
  toSecret,
);

const getOutgoingSecretImpl = promisifyGet(
  'SELECT * FROM osecret WHERE id = ?',
  (id: string) => id,
  toSecret,
);

const setIncomingSecretImpl = promisifyRun(
  `INSERT INTO isecret (id, secret, created) VALUES ($id, $secret, $created)
    ON CONFLICT(id) DO UPDATE SET secret=$secret, created=$created`,
  (id: string, secret: bigint, revision: number) => ({
    $id: id,
    $secret: `v1:${revision}:${srpSessionKeyToBuffer(secret).toString('base64')}`,
    $created: Date.now(),
  }),
);

const clearIncomingSecretsImpl = promisifyRun('DELETE FROM isecret', () => []);

export const setIncomingSecret = (id: string, secret: bigint, revision: number): Promise<unknown> =>
  setIncomingSecretImpl(id, secret, revision);

export const clearIncomingSecrets = async (): Promise<void> => {
  await clearIncomingSecretsImpl();
  isecrets.clear();
};

export const setOutgoingSecret = promisifyRun(
  `INSERT INTO osecret (id, secret) VALUES ($id, $secret)
    ON CONFLICT(id) DO UPDATE SET secret=$secret`,
  (id: string, secret: bigint) => ({
    $id: id,
    $secret: Buffer.from(secret.toString(16), 'hex').toString('base64'),
  }),
);

export const getIncomingSecret = async (id: string) => {
  return (await getIncomingSecretWithRevision(id))?.secret;
};

export const getIncomingSecretWithRevision = async (id: string) => {
  const revisionBefore = (await getRemoteAuthCredentials()).revision;
  const cached = isecrets.get(id);
  if (cached) return { secret: cached, revision: revisionBefore };
  const stored = await getIncomingSecretImpl(id);
  const revisionAfter = (await getRemoteAuthCredentials()).revision;
  if (!stored || stored.revision !== revisionBefore || stored.revision !== revisionAfter)
    return undefined;
  return { secret: stored.secret, revision: revisionAfter };
};

export const getOutgoingSecret = async (id: string) =>
  osecrets.get(id) ?? (await getOutgoingSecretImpl(id))?.secret;

const secret = randomBytes(48);

export const getRemoteCredentials = async (url: string): Promise<Credentials | undefined> => {
  try {
    const response = await fetch(url);
    // debug(`${url}, ${response.ok}:${JSON.stringify(response)}`);
    if (!response.ok) return undefined;
    const remote = await response.text();
    return {
      identifier: localConfig.get('identifier'),
      apiSecret: await getOutgoingSecret(remote),
    };
  } catch (error) {
    debug(`error while getRemoteCredentials: ${(error as Error).message}`);
    return undefined;
  }
};

void app.whenReady().then(() => {
  ipcMain.handle('getRemoteCredentials', (_, url) => getRemoteCredentials(url));
  ipcMain.handle('getLocalCredentials', (): Credentials => ({
    identifier: localConfig.get('identifier'),
    apiSecret: secret,
  }));
  ipcMain.on('setRemoteSecret', (_, id: string, apiSecret: bigint | null) => {
    if (apiSecret) void setOutgoingSecret(id, apiSecret);
  });
});

export default secret;
