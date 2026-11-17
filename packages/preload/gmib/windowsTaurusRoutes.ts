import { ipcRenderer } from 'electron';

import type { WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';

export const isSupportedPlatform = process.platform === 'win32' || process.platform === 'linux';

export const inspect = (): Promise<WindowsTaurusRouteStatus> =>
  ipcRenderer.invoke('windowsTaurusRoutes:inspect');

export const repair = (deviceId: string): Promise<void> =>
  ipcRenderer.invoke('windowsTaurusRoutes:repair', deviceId);

export const commands = (deviceId: string): Promise<string> =>
  ipcRenderer.invoke('windowsTaurusRoutes:commands', deviceId);

export const setAutomatic = (deviceId: string, enabled: boolean): Promise<void> =>
  ipcRenderer.invoke('windowsTaurusRoutes:setAutomatic', deviceId, enabled);

export const automaticCommands = (deviceId: string, enabled: boolean): Promise<string> =>
  ipcRenderer.invoke('windowsTaurusRoutes:automaticCommands', deviceId, enabled);
