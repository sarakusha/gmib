/* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["event"] }] */
import { dialog, ipcMain } from 'electron';

ipcMain.on('showOpenDialogSync', (event, options: Electron.OpenDialogSyncOptions) => {
  event.returnValue = dialog.showOpenDialogSync(options);
});

ipcMain.on('showSaveDialogSync', (event, options: Electron.SaveDialogSyncOptions) => {
  event.returnValue = dialog.showSaveDialogSync(options);
});

ipcMain.on('showErrorBox', (event, title: string, content: string) => {
  dialog.showErrorBox(title, content);
});
