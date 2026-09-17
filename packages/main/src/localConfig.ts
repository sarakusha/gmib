import { app, ipcMain } from 'electron';

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
