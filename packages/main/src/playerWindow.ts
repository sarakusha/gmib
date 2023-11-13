import { app, BrowserWindow } from 'electron';
import path from 'path';

import debugFactory from 'debug';

import type { Player } from '/@common/video';

import authRequest from './authRequest';
import createWindow from './createWindow';
import { dbReady } from './db';
import localConfig from './localConfig';
import main from './mainWindow';
import openHandler from './openHandler';
import relaunch, { needRestart } from './relaunch';
import { getPlayer, getPlayers, updateHidePlayer, updateShowPlayer } from './screen';
import { findPlayerWindow, getAllGmibParams, registerPlayer } from './windowStore';

const preload = path.join(__dirname, '../../preload/dist/player.cjs');
const remotePreload = path.join(__dirname, '../../preload/dist/remote.cjs');
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playerWindow`);

let isQuitting = false;

app.once('quit', () => {
  isQuitting = true;
});

export const getPlayerTitle = (player: Player): string =>
  `\u25b6 ${player.name ?? `player#${player.id}`}`;

export const openPlayer = async (
  id: number,
  gmibParams = getAllGmibParams()[0],
): Promise<BrowserWindow | undefined> => {
  const { host, nibusPort, info } = gmibParams;
  const isRemote = host !== 'localhost';
  let player: Player | undefined;
  let browserWindow = findPlayerWindow(id, host);
  if (isRemote) {
    if (!browserWindow) {
      const res = await authRequest({ host, port: nibusPort + 1, api: `/player/${id}` });
      if (res?.ok) player = await res.json();
    }
  } else {
    await Promise.all([dbReady, main]);
    const [gmib] = getAllGmibParams();
    if (gmib?.plan && ['plus', 'premium', 'enterprise'].includes(gmib.plan))
      player = await getPlayer(id);
  }
  if (!browserWindow) {
    if (!player) return undefined;
    const query = `source_id=${id}&host=${host}&port=${nibusPort}`;
    const url =
      import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL
        ? `${import.meta.env.VITE_DEV_SERVER_URL}player.html?${query}`
        : `http://localhost:${nibusPort + 1}/player.html?${query}`;
    const title = getPlayerTitle(player);
    browserWindow = createWindow(
      isRemote ? `${info?.name ?? host}:${title}` : title,
      isRemote ? remotePreload : preload,
    );
    registerPlayer(browserWindow, { host, port: nibusPort, playerId: id }, gmibParams);
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
      if (import.meta.env.PROD && ![/* 'clean-exit', */ 'killed'].includes(details.reason)) {
        debug('relaunch...');
        relaunch();
      }
    });
    browserWindow.on('close', event => {
      isQuitting || updateHidePlayer(id);
      if (!needRestart() && !isQuitting && localConfig.get('autostart')) {
        event.preventDefault();
        browserWindow?.hide();
      } else if (!isRemote && !gmibParams.autostart) {
        const parent = BrowserWindow.fromId(gmibParams.id);
        if (parent && !parent.isVisible()) {
          setTimeout(() => parent.close(), 100);
        }
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
  const players = await getPlayers();
  players.forEach(player => {
    if (player.playlistId && player.autoPlay) openPlayer(player.id);
  });
};
