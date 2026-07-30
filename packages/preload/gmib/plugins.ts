import { ipcRenderer } from 'electron';

import type { PluginInstallResult, PluginStatus } from '/@common/plugins';

export const list = (): Promise<PluginStatus[]> => ipcRenderer.invoke('plugins:list');

export const install = (): Promise<PluginInstallResult> => ipcRenderer.invoke('plugins:install');

export const setEnabled = (id: string, enabled: boolean): Promise<PluginStatus> =>
  ipcRenderer.invoke('plugins:setEnabled', id, enabled);

export const uninstall = (id: string): Promise<boolean> =>
  ipcRenderer.invoke('plugins:uninstall', id);

export const openControl = (id: string): Promise<void> =>
  ipcRenderer.invoke('plugins:openControl', id);

export const restart = (): Promise<void> => ipcRenderer.invoke('plugins:restart');
