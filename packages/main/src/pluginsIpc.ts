import { app, ipcMain } from 'electron';

import {
  installPluginFromDialog,
  listPlugins,
  openPluginControl,
  setPluginEnabled,
  uninstallPlugin,
} from './pluginHost';
import relaunch from './relaunch';

void app.whenReady().then(() => {
  ipcMain.handle('plugins:list', () => listPlugins());
  ipcMain.handle('plugins:install', () => installPluginFromDialog());
  ipcMain.handle('plugins:setEnabled', (_, id: string, enabled: boolean) =>
    setPluginEnabled(id, enabled),
  );
  ipcMain.handle('plugins:uninstall', (_, id: string) => uninstallPlugin(id));
  ipcMain.handle('plugins:openControl', (_, id: string) => openPluginControl(id));
  ipcMain.handle('plugins:restart', () => relaunch());
});
