import { app, ipcMain } from 'electron';

import { nanoid } from 'nanoid';
import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import debugFactory from 'debug';
import type { Schema } from 'electron-store';
import Store from 'electron-store';
import crypto from 'node:crypto';

import machineId from './machineId';

import type { LocalConfig } from '/@common/helpers';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);

const localConfigSchema: Schema<LocalConfig> = {
  hosts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        port: { type: 'number' },
        address: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['port', 'address'],
    },
    default: [],
  },
  autostart: { type: 'boolean', default: false },
  health: {
    type: 'object',
    properties: {
      screens: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            aggregations: {
              type: 'array',
              items: { type: 'integer' },
              maxItems: 3,
              minItems: 3,
            },
            maxBrightness: { type: 'integer' },
          },
        },
        default: {},
      },
      timestamp: { type: 'integer' },
    },
    default: {},
  },
  salt: { type: 'string' },
  verifier: { type: 'string' },
  identifier: { type: 'string', default: nanoid(), readOnly: true },
  announce: { type: 'string' },
  iv: { type: 'string' },
};

const localConfig = new Store<LocalConfig>({
  name: `${import.meta.env.VITE_APP_NAME}-local`,
  schema: localConfigSchema,
  clearInvalidConfig: true,
  watch: true,
});

if (!localConfig.get('salt') || !localConfig.get('verifier')) {
  const routines = new SRPRoutines(new SRPParameters());
  const password = 'nata-info';
  createVerifierAndSalt(routines, 'gmib', password).then(({ v, s }) => {
    debug(`set default password: ${password}`);
    localConfig.set('verifier', `0x${v.toString(16)}`);
    localConfig.set('salt', `0x${s.toString(16)}`);
  });
}

export const getAnnounce = async () => {
  const announce = localConfig.get('announce');
  const iv = localConfig.get('iv');
  if (!announce || !iv) return announce;
  const key = await machineId;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'base64'),
    );
    const jsn = [decipher.update(announce, 'base64', 'utf-8'), decipher.final('utf-8')].join('');
    return JSON.parse(jsn);
  } catch (err) {
    debug(`error while decode: ${(err as Error).message}`);
    return announce;
  }
};

app.whenReady().then(() => {
  ipcMain.handle('getLocalConfig', async (_, name: keyof LocalConfig) => {
    const value = localConfig.get(name);
    if (name === 'announce' && typeof value === 'string') {
      const announce = await getAnnounce();
      if ('message' in announce) {
        delete announce.message;
        return announce;
      }
    }
    return value;
  });
  ipcMain.handle('setLocalConfig', (_, name: keyof LocalConfig, value: unknown) => {
    localConfig.set(name, value);
  });
});
export default localConfig;
