import { app, ipcMain } from 'electron';
import { getMediaByMD5 } from './media';
import { getPlayerMappingsForPlayer } from './playerMapping';
import { getPlaylist, getPlaylistItems } from './playlist';
import { getPlayer, getScreens, loadScreen } from './screen';

app.whenReady().then(() => {
  ipcMain.handle('getPlayer', (_, id) => getPlayer(id));
  ipcMain.handle('getPlaylist', async (_, id) => {
    const playlist = await getPlaylist(id);
    const items = await getPlaylistItems(id) ?? [];
    return { ...playlist, items };
  });
  ipcMain.handle('getMedia', (_, md5) => getMediaByMD5(md5));
  ipcMain.handle('getPlayerMappings', (_, id: number) => getPlayerMappingsForPlayer(id));
  ipcMain.handle('getScreen', (_, id: number) => loadScreen(id));
  ipcMain.handle('getScreens', getScreens);
});