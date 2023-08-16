import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import path from 'path';

import debugFactory from 'debug';

import createWindow from './createWindow';
import { dbReady } from './db';
import openHandler from './openHandler';
import { getPlayer, getPlayers, updateHidePlayer, updateShowPlayer } from './screen';
import { playerWindows, remotePlayers } from './windows';
import localConfig from './localConfig';

import generateSignature from '/@common/generateSignature';
import type { Player } from '/@common/video';
import relaunch from './relaunch';
import { getRemoteCredentials } from './secret';

const preload = path.join(__dirname, '../../preload/dist/player.cjs');
const remotePreload = path.join(__dirname, '../../preload/dist/remote.cjs');
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playerWindow`);

let isQuitting = false;

app.once('quit', () => {
  isQuitting = true;
});

export const getPlayerTitle = (player: Player): string =>
  `\u25b6 ${player.name ?? `player#${player.id}`}`;

// eslint-disable-next-line import/prefer-default-export
export const openPlayer = async (
  id: number,
  host = 'localhost',
  port = +(process.env['NIBUS_PORT'] ?? 9001),
  // token = secret,
): Promise<BrowserWindow | undefined> => {
  const isRemote = host !== 'localhost';
  let player: Player | undefined;
  let browserWindow: BrowserWindow | undefined;
  const key = `${host}:${port}:${id}`;
  if (isRemote) {
    browserWindow = remotePlayers.get(key);
    if (!browserWindow) {
      const baseUrl = `http://${host}:${port + 1}`;
      const credentials = await getRemoteCredentials(`${baseUrl}/api/identifier`);
      if (!credentials?.apiSecret || !credentials?.identifier) return undefined;
      const now = Date.now();
      const api = `${baseUrl}/api/player/${id}`;
      const sign = generateSignature(credentials.apiSecret, 'GET', api, now);
      // console.log({ api });
      const res = await fetch(api, {
        headers: {
          'x-ni-identifier': credentials.identifier,
          'x-ni-timestamp': now.toString(),
          'x-ni-signature': sign,
        },
      });
      if (res.ok) player = await res.json();
      debug(JSON.stringify(player));
    }
  } else {
    await dbReady;
    player = await getPlayer(id);
    browserWindow = playerWindows.get(id);
  }
  if (!browserWindow) {
    if (!player) return undefined;
    const query = `source_id=${id}&host=${host}&port=${port}`;
    const url =
      import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL
        ? `${import.meta.env.VITE_DEV_SERVER_URL}player.html?${query}`
        : `http://localhost:${+(process.env['NIBUS_PORT'] ?? 9001) + 1}/player.html?${query}`;
    const title = getPlayerTitle(player);
    browserWindow = createWindow(isRemote ? `${host}:${title}` : title, isRemote ? remotePreload : preload);
    if (isRemote) remotePlayers.set(key, browserWindow);
    else playerWindows.set(id, browserWindow);
    browserWindow.loadURL(url).catch(err => {
      debug(`error while load player ${url}: ${err.message}`);
    });
    browserWindow.webContents.setWindowOpenHandler(openHandler);
    browserWindow.webContents.setVisualZoomLevelLimits(1, 1);
    // browserWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
    //   setTimeout(() => browserWindow?.webContents.setZoomFactor(1.0), 100);
    //   debug(`zoom: ${browserWindow?.webContents.getZoomFactor()}`);
    // });
    // browserWindow.webContents.setLayoutZoomLevelLimits(0, 0);
    // browserWindow.show();
    browserWindow.webContents.on('render-process-gone', (event, details) => {
      debug(`<<<<CRASH>>>> player process gone: ${details.reason} (${details.exitCode})`);
      if (import.meta.env.PROD && !['clean-exit', 'killed'].includes(details.reason)) {
        debug('relaunch...');
        relaunch();
      }
    });
    browserWindow.on('close', event => {
      isQuitting || updateHidePlayer(id);
      if (!isQuitting && localConfig.get('autostart')) {
        event.preventDefault();
        browserWindow?.hide();
      } else {
        playerWindows.delete(id);
      }
    });
    browserWindow.on('show', () => {
      updateShowPlayer(id);
    });
    // player.hidden ||
    browserWindow.once('ready-to-show', () => {
      browserWindow?.show();
    });
    // browserWindow.setSkipTaskbar(false);
  } else {
    browserWindow.show();
    browserWindow.focus();
  }
  return browserWindow;
};

export const launchPlayers = async () => {
  await dbReady;
  await app.whenReady;
  const players = await getPlayers();
  players.forEach(player => {
    if (player.playlistId && player.autoPlay) openPlayer(player.id);
  });
};
