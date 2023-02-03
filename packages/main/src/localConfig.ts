import { app, ipcMain } from 'electron';

import { nanoid } from 'nanoid';
import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import debugFactory from 'debug';
import type { Schema } from 'electron-store';
import Store from 'electron-store';

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

app.whenReady().then(() => {
  ipcMain.handle('getLocalConfig', (_, name: keyof LocalConfig) => localConfig.get(name));
  ipcMain.handle('setLocalConfig', (_, name: keyof LocalConfig, value: unknown) => {
    localConfig.set(name, value);
  });
});
export default localConfig;
