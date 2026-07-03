import { app, dialog } from 'electron';
import path from 'path';

import debugFactory from 'debug';

import { supportsFeature } from '/@common/capabilities';
import type { Player } from '/@common/video';

import authRequest from './authRequest';
import { dbReady } from './db';
import localConfig from './localConfig';
import main, { activateMainWindow } from './mainWindow';
import type { CloseEvent, ManagedWindow } from './managedWindow';
import { installWindowOpenHandler } from './openHandler';
import relaunch, { needRestart } from './relaunch';
import { getPlayer, getPlayers, isPlayerActive, updateShowPlayer } from './screen';
import { createTabbedWindow } from './tabbedWindow';
import {
  findPlayerWindow,
  getAllGmibParams,
  registerPlayer,
} from './windowStore';

import type { GmibWindowParams } from '/@common/WindowParams';

const preload = path.join(__dirname, '../../preload/dist/player.cjs');
const remotePreload = path.join(__dirname, '../../preload/dist/remote.cjs');
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playerWindow`);
const isDevRuntime = import.meta.env.DEV && !app.isPackaged;

let isQuitting = false;

app.once('before-quit', () => {
  isQuitting = true;
});

export const getPlayerTitle = (player: Player): string =>
  `\u25b6 ${player.name ?? `player#${player.id}`}`;

type Options = {
  gmibParams?: GmibWindowParams;
  hidden?: boolean;
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const waitForLocalGmibParams = async (): Promise<GmibWindowParams | undefined> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const gmibParams = getAllGmibParams().find(({ host }) => host === 'localhost');
    if (gmibParams) return gmibParams;
    await sleep(100);
  }
  return undefined;
};

const confirmClose = (hasVisibleParent?: boolean) =>
  dialog.showMessageBox({
    message: hasVisibleParent
      ? 'Остановить и закрыть плеер?'
      : 'Остановить плеер и закрыть приложение?',
    type: 'question',
    buttons: ['Закрыть', 'Не останавливать, скрыть'],
    defaultId: 1,
    title: 'Закрыть плеер',
    detail: 'В данный момент продолжается воспроизведение',
  });

const confirmCloseRemoteOutput = (player?: Player) =>
  dialog.showMessageBox({
    message: 'Закрыть окно вывода удаленного плеера?',
    type: 'question',
    buttons: ['Закрыть вывод', 'Оставить'],
    defaultId: 1,
    cancelId: 1,
    title: 'Закрыть вывод удаленного плеера',
    detail: `Плеер ${player?.name ?? (player ? `player#${player.id}` : '')} остановлен.`,
  });

const isStopped = (player: Player): boolean => !player.autoPlay && !player.current;

const closeRemoteOutputIfStopped = async (
  playerId: number,
  gmibParams: GmibWindowParams,
): Promise<void> => {
  const { host, nibusPort } = gmibParams;
  if (!supportsFeature('remotePlayerOutputClose', gmibParams.info?.version, true)) return;

  const res = await authRequest({ host, port: nibusPort + 1, api: `/player/${playerId}` });
  if (!res?.ok) return;

  const remotePlayer = (await res.json()) as Player;
  if (!isStopped(remotePlayer)) return;

  const { response } = await confirmCloseRemoteOutput(remotePlayer);
  if (response !== 0) return;

  await authRequest({
    api: `/player/${playerId}/output`,
    host,
    port: nibusPort + 1,
    method: 'DELETE',
  });
};

export const openPlayer = async (
  id: number,
  options?: Options,
): Promise<ManagedWindow | undefined> => {
  const { gmibParams = getAllGmibParams()[0], hidden = false } = options ?? {};
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
    const query = new URLSearchParams({
      source_id: `${id}`,
      host,
      port: `${nibusPort}`,
    });
    if (info?.version) query.set('version', info.version);
    const url =
      isDevRuntime && import.meta.env.VITE_DEV_SERVER_URL
        ? `${import.meta.env.VITE_DEV_SERVER_URL}player.html?${query.toString()}`
        : `http://localhost:${nibusPort + 1}/player.html?${query.toString()}`;
    const title = getPlayerTitle(player);
    browserWindow = createTabbedWindow(
      isRemote ? `${info?.name ?? host}:${title}` : title,
      isRemote ? remotePreload : preload,
    );
    registerPlayer(browserWindow, { host, port: nibusPort, playerId: id }, gmibParams);
    isQuitting = false;
    browserWindow.loadURL(url).catch(err => {
      debug(`error while load player ${url}: ${err instanceof Error ? err.message : String(err)}`);
    });
    installWindowOpenHandler(browserWindow.webContents);
    void browserWindow.webContents.setVisualZoomLevelLimits(1, 1);
    // browserWindow.webContents.on('did-create-window', win => {
    //   win.once('ready-to-show', () => {
    //     console.log('READY');
    //     win.maximize();
    //     win.setFullScreen(true);
    //     win.setKiosk(true);
    //     win.setAlwaysOnTop(true);
    //   });
    // });
    // browserWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
    //   setTimeout(() => browserWindow?.webContents.setZoomFactor(1.0), 100);
    //   debug(`zoom: ${browserWindow?.webContents.getZoomFactor()}`);
    // });
    // browserWindow.webContents.setLayoutZoomLevelLimits(0, 0);
    // browserWindow.show();
    let remoteCloseInProgress = false;
    browserWindow.webContents.on('render-process-gone', (event, details) => {
      debug(`<<<<CRASH>>>> player process gone: ${details.reason} (${details.exitCode})`);
      if (
        import.meta.env.PROD &&
        !isQuitting &&
        ![/* 'clean-exit', */ 'killed'].includes(details.reason)
      ) {
        debug('relaunch...');
        relaunch();
      }
    });
    browserWindow.on('close', event => {
      const closeEvent = event as CloseEvent;
      if (isRemote && !isQuitting) {
        if (remoteCloseInProgress) return;
        remoteCloseInProgress = true;
        closeEvent.preventDefault();
        void closeRemoteOutputIfStopped(id, gmibParams)
          .catch(err => {
            debug(
              `error while close remote player output: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          })
          .finally(() => {
            browserWindow?.close();
          });
      } else if (!needRestart() && !isQuitting) {
        closeEvent.preventDefault();
        browserWindow?.hide();
        if (!localConfig.get('autostart')) {
          void isPlayerActive(id).then(async isActive => {
            if (isActive && import.meta.env.PROD) {
              const { response } = await confirmClose();
              if (response === 1) return;
            }
            isQuitting = true;
            browserWindow?.close();
          });
        }
      }
    });
    browserWindow.on('show', () => {
      void updateShowPlayer(id);
    });
    if (!hidden)
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
  const localPlayerTabs = localConfig.get('localPlayerTabs');
  if (localPlayerTabs) {
    const gmibParams = await waitForLocalGmibParams();
    const restored = gmibParams
      ? await Promise.all(localPlayerTabs.map(id => openPlayer(id, { gmibParams })))
      : [];
    if (restored.every(window => window === undefined) && localConfig.get('localGmibHidden')) {
      activateMainWindow();
    }
    return;
  }
  players.forEach(player => {
    if (player.playlistId && player.autoPlay) void openPlayer(player.id, { hidden: true });
  });
};
