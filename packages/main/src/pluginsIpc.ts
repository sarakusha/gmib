import { app, ipcMain } from 'electron';

import {
  installPluginFromDialog,
  listPlugins,
  openPluginControl,
  setPluginEnabled,
  uninstallPlugin,
} from './pluginHost';
import { installOfficialPlugin, listOfficialPlugins } from './pluginCatalog';
import relaunch from './relaunch';
import { requireLicenseCapability } from './licenseState';

void app.whenReady().then(() => {
  ipcMain.handle('plugins:list', () => listPlugins());
  ipcMain.handle('plugins:catalog', () => listOfficialPlugins());
  ipcMain.handle('plugins:install', () => {
    requireLicenseCapability('plugins');
    return installPluginFromDialog();
  });
  ipcMain.handle('plugins:installOfficial', (_, id: string) => {
    requireLicenseCapability('plugins');
    return installOfficialPlugin(id);
  });
  ipcMain.handle('plugins:setEnabled', (_, id: string, enabled: boolean) =>
    setPluginEnabled(id, enabled),
  );
  ipcMain.handle('plugins:uninstall', (_, id: string) => uninstallPlugin(id));
  ipcMain.handle('plugins:openControl', (_, id: string) => openPluginControl(id));
  ipcMain.handle('plugins:restart', () => relaunch());
});
