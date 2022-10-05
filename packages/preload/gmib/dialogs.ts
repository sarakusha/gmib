import { ipcRenderer } from 'electron';
import type { Dialog, SaveDialogSyncOptions } from 'electron';
import { readFileSync, writeFileSync } from 'fs';

import { setRemoteDialogOpen } from '/@renderer/store/currentSlice';

import ipcDispatch from '../common/ipcDispatch';

export const showOpenDialogSync: Dialog['showOpenDialogSync'] = options =>
  ipcRenderer.sendSync('showOpenDialogSync', options);

export const showErrorBox: Dialog['showErrorBox'] = (title, content) =>
  ipcRenderer.sendSync('showErrorBox', title, content);

const showSaveDialogSync: Dialog['showSaveDialogSync'] = options =>
  ipcRenderer.sendSync('showSaveDialogSync', options);

type SaveOpts = Pick<SaveDialogSyncOptions, 'title' | 'defaultPath'> & {
  data: Record<string, unknown>;
};

export const saveJSON = (options: SaveOpts): boolean => {
  const { title = 'Сохранить как', defaultPath, data } = options;
  const fileName: string | undefined = showSaveDialogSync({
    title,
    defaultPath,
    filters: [
      {
        name: 'JSON',
        extensions: ['json'],
      },
    ],
  });
  if (fileName) {
    writeFileSync(fileName, JSON.stringify(data, null, 2));
    return true;
  }
  return false;
};

export const loadJSON = (title = 'Загрузить из'): Record<string, unknown> | null => {
  const [fileName] =
    showOpenDialogSync({
      title,
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
      properties: ['openFile'],
    }) ?? [];
  if (fileName) {
    try {
      return JSON.parse(readFileSync(fileName).toString());
    } catch (e) {
      showErrorBox('Ошибка загрузки', 'Файл испорчен');
    }
  }
  return null;
};

ipcRenderer.on('editRemoteHosts', () => ipcDispatch(setRemoteDialogOpen(true)));
