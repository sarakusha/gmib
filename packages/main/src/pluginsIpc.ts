import { app, ipcMain } from 'electron';

import { isGmib } from '/@common/WindowParams';
import { openPluginControl } from './pluginHost';
import { pluginLifecycle } from './pluginLifecycle';
import {
  installOfficialPluginFromDialog,
  installPluginFromDialog,
  uninstallPluginFromDialog,
} from './pluginLifecycleUi';
import relaunch from './relaunch';
import { requireLicenseCapability } from './licenseState';
import { findParamsByWebContentsId } from './windowStore';
import { createRemotePluginLifecycle, requireRemotePluginSupport } from './remotePluginLifecycle';
import { openRemotePluginControl } from './remotePluginControl';

const context = (event: Electron.IpcMainInvokeEvent) => {
  const params = findParamsByWebContentsId(event.sender.id);
  if (!isGmib(params)) throw new Error('Управление плагинами доступно только из подключения GMIB');
  if (params.host !== 'localhost') {
    requireRemotePluginSupport(params);
    return { params, remote: createRemotePluginLifecycle(params) };
  }
  return { params, remote: undefined };
};

void app.whenReady().then(() => {
  ipcMain.handle('plugins:list', event => {
    const { remote } = context(event);
    return remote ? remote.list() : pluginLifecycle.list();
  });
  ipcMain.handle('plugins:catalog', event => {
    const { remote } = context(event);
    return remote ? remote.catalog() : pluginLifecycle.catalog();
  });
  ipcMain.handle('plugins:install', event => {
    const { remote } = context(event);
    if (remote) return remote.install();
    requireLicenseCapability('plugins');
    return installPluginFromDialog();
  });
  ipcMain.handle('plugins:installOfficial', (event, id: string) => {
    const { remote } = context(event);
    if (remote) return remote.installOfficial(id);
    requireLicenseCapability('plugins');
    return installOfficialPluginFromDialog(id);
  });
  ipcMain.handle('plugins:setEnabled', (event, id: string, enabled: boolean) => {
    const { remote } = context(event);
    return remote
      ? remote.setEnabled(id, enabled)
      : pluginLifecycle.setEnabled(id, enabled).then(result => result.plugin);
  });
  ipcMain.handle('plugins:uninstall', (event, id: string) => {
    const { remote } = context(event);
    return remote ? remote.uninstall(id) : uninstallPluginFromDialog(id);
  });
  ipcMain.handle('plugins:openControl', (event, id: string) => {
    const { params, remote } = context(event);
    return remote ? openRemotePluginControl(params, id, event.sender) : openPluginControl(id);
  });
  ipcMain.handle('plugins:restart', event => {
    const { remote } = context(event);
    return remote ? remote.restart() : relaunch();
  });
});
