import { randomBytes } from 'crypto';
import { app, ipcMain } from 'electron';

import debugFactory from 'debug';

import type { NullableOptional } from '/@common/helpers';
import type { Credentials } from '/@common/Credentials';

import { promisifyGet, promisifyRun, removeNull } from './db';
import localConfig from './localConfig';

export type Secret = {
  id: string;
  secret: Buffer;
  created?: Date;
};

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:secret`);

const isecrets = new Map<string, Buffer>();
const osecrets = new Map<string, Buffer>();

const toSecret = (res: NullableOptional): Secret => {
  const { id, secret, created } = removeNull(res);
  return {
    id,
    secret: Buffer.from(secret, 'base64'),
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

export const setIncomingSecret = promisifyRun(
  `INSERT INTO isecret (id, secret, created) VALUES ($id, $secret, $created)
    ON CONFLICT(id) DO UPDATE SET secret=$secret, created=$created`,
  (id: string, secret: bigint) => ({
    $id: id,
    $secret: Buffer.from(secret.toString(16), 'hex').toString('base64'),
    $created: Date.now(),
  }),
);

export const setOutgoingSecret = promisifyRun(
  `INSERT INTO osecret (id, secret) VALUES ($id, $secret)
    ON CONFLICT(id) DO UPDATE SET secret=$secret`,
  (id: string, secret: bigint) => ({
    $id: id,
    $secret: Buffer.from(secret.toString(16), 'hex').toString('base64'),
  }),
);

export const getIncomingSecret = async (id: string) =>
  isecrets.get(id) ?? (await getIncomingSecretImpl(id))?.secret;

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

app.whenReady().then(() => {
  ipcMain.handle('getRemoteCredentials', (_, url) => getRemoteCredentials(url));
  ipcMain.handle(
    'getLocalCredentials',
    (): Credentials => ({ identifier: localConfig.get('identifier'), apiSecret: secret }),
  );
  ipcMain.on('setRemoteSecret', (_, id: string, apiSecret: bigint | null) => {
    apiSecret && setOutgoingSecret(id, apiSecret);
  });
});

export default secret;
