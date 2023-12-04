import { app, BrowserWindow, ipcMain } from 'electron';

import { getMediaByMD5 } from './media';
import { getPlayerMappingsForPlayer } from './playerMapping';
import { getPlaylist, getPlaylistItems } from './playlist';
import { getPlayer, loadScreen } from './screen';
import { broadcast } from './server';
import store, { findScreenParams } from './windowStore';

import { isGmib } from '/@common/WindowParams';

app.whenReady().then(() => {
  ipcMain.handle('getPlayer', (_, id) => getPlayer(id));
  ipcMain.handle('getPlaylist', async (_, id) => {
    const playlist = await getPlaylist(id);
    const items = (await getPlaylistItems(id)) ?? [];
    return { ...playlist, items };
  });
  ipcMain.handle('getMedia', (_, md5) => getMediaByMD5(md5));
  ipcMain.handle('getPlayerMappings', (_, id: number) => getPlayerMappingsForPlayer(id));
  ipcMain.handle('getScreen', (_, id: number) => loadScreen(id));
  ipcMain.handle('getMediaSourceId', (_, screenId: number) => {
    const params = findScreenParams(screenId);
    if (params) {
      const win = BrowserWindow.fromId(params.id);
      if (win) return win.getMediaSourceId();
    }
    return undefined;
  });
  // ipcMain.handle('getScreens', getScreens); // TODO: Возможно не используется
  ipcMain.handle('getMachineId', event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return undefined;
    const params = store.get(win.id);
    return isGmib(params) ? params.machineId : undefined;
  });
  ipcMain.on('broadcast', (_, eventName: string, data: unknown[]) => {
    broadcast({ event: eventName, data });
  });
});

// eslint-disable-next-line import/prefer-default-export
// export const getHostOptions = async (
//   wind = BrowserWindow.getFocusedWindow(),
// ): Promise<Partial<Host> | undefined> => {
//   if (!wind) return undefined;
//   const { webContents } = wind;
//   return new Promise((resolve, reject) => {
//     let timeout: NodeJS.Timeout;
//     const handler = (event: IpcMainEvent, host: Partial<Host>) => {
//       if (event.sender !== webContents) return;
//       ipcMain.off('host-options', handler);
//       clearTimeout(timeout);
//       resolve(host);
//     };
//     ipcMain.on('host-options', handler);
//     webContents.send('get-host-options');
//     timeout = setTimeout(() => {
//       ipcMain.off('host-options', handler);
//       reject(new Error('timeout'));
//     }, 500);
//   });
// };
