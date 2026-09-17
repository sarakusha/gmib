import { app, ipcMain } from 'electron';

import { openPluginControl } from './pluginHost';
import { pluginLifecycle } from './pluginLifecycle';
import {
  installOfficialPluginFromDialog,
  installPluginFromDialog,
  uninstallPluginFromDialog,
} from './pluginLifecycleUi';
import relaunch from './relaunch';
import { requireLicenseCapability } from './licenseState';

void app.whenReady().then(() => {
  ipcMain.handle('plugins:list', () => pluginLifecycle.list());
  ipcMain.handle('plugins:catalog', () => pluginLifecycle.catalog());
  ipcMain.handle('plugins:install', () => {
    requireLicenseCapability('plugins');
    return installPluginFromDialog();
  });
  ipcMain.handle('plugins:installOfficial', (_, id: string) => {
    requireLicenseCapability('plugins');
    return installOfficialPluginFromDialog(id);
  });
  ipcMain.handle('plugins:setEnabled', (_, id: string, enabled: boolean) =>
    pluginLifecycle.setEnabled(id, enabled).then(result => result.plugin),
  );
  ipcMain.handle('plugins:uninstall', (_, id: string) => uninstallPluginFromDialog(id));
  ipcMain.handle('plugins:openControl', (_, id: string) => openPluginControl(id));
  ipcMain.handle('plugins:restart', () => relaunch());
});
