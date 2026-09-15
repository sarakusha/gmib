import { app, ipcMain } from 'electron';

import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import debugFactory from 'debug';
import Store from 'electron-store';

import type { LocalConfig } from '/@common/helpers';

import { isRendererConfigKey } from './localConfigAccess';
import { localConfigSchema } from './localConfigSchema';

export const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);

const localConfig = new Store<LocalConfig>({
  name: `${import.meta.env.VITE_APP_NAME}-local`,
  schema: localConfigSchema,
  clearInvalidConfig: true,
  watch: true,
});

if (!localConfig.get('salt') || !localConfig.get('verifier')) {
  const routines = new SRPRoutines(new SRPParameters());
  const password = 'nata-info';
  void createVerifierAndSalt(routines, 'gmib', password).then(({ v, s }) => {
    debug(`set default password: ${password}`);
    localConfig.set('verifier', `0x${v.toString(16)}`);
    localConfig.set('salt', `0x${s.toString(16)}`);
  });
}

void app.whenReady().then(() => {
  ipcMain.handle('getLocalConfig', (_, name: unknown) => {
    if (!isRendererConfigKey(name)) throw new Error('Unsupported local configuration key');
    return localConfig.get(name);
  });
  ipcMain.handle('setLocalConfig', (_, name: unknown, value: unknown) => {
    if (!isRendererConfigKey(name)) throw new Error('Unsupported local configuration key');
    localConfig.set(name, value);
  });
});

export default localConfig;
