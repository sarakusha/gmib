import { ipcRenderer } from 'electron';

import type { LocalConfig } from '/@common/helpers';

export const get = <Key extends keyof LocalConfig>(key: Key): Promise<LocalConfig[Key]> =>
  ipcRenderer.invoke('getLocalConfig', key);
export const set = <Key extends keyof LocalConfig>(
  key: Key,
  value: LocalConfig[Key],
): Promise<void> => ipcRenderer.invoke('setLocalConfig', key, value);
