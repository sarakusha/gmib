import { randomBytes } from 'crypto';
import { app, ipcMain } from 'electron';

import debugFactory from 'debug';
import fetch from 'node-fetch';

import type { NullableOptional } from '/@common/helpers';
import type { Identity } from '/@common/Identity';

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

app.whenReady().then(() => {
  ipcMain.handle('getRemoteIdentification', async (_, url): Promise<Identity | undefined> => {
    const response = await fetch(url);
    debug(`${url}, ${response.ok}:${response}`);
    if (!response.ok) return undefined;
    const identifier = await response.text();

    const apiSecret = await getOutgoingSecret(identifier);
    return {
      identifier,
      apiSecret,
    };
  });
  ipcMain.handle(
    'getLocalIdentification',
    (): Identity => ({ identifier: localConfig.get('identifier'), apiSecret: secret }),
  );
  ipcMain.handle('setRemoteSecret', async (_, id: string, apiSecret: bigint) => {
    await setOutgoingSecret(id, apiSecret);
  });
});

export default secret;
