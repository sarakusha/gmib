import type { WebContents } from 'electron';
import { app, BrowserWindow, powerSaveBlocker } from 'electron';
import { join } from 'path';

import debugFactory from 'debug';

import localConfig from './localConfig';
import type { CloseEvent, ManagedWindow } from './managedWindow';
import relaunch, { needRestart } from './relaunch';
import { createTabbedWindow, getTabbedWindowItems } from './tabbedWindow';
import store, { getAllScreenParams, registerGmib } from './windowStore';

import Deferred from '/@common/Deferred';
import { isGmib, isPlayer } from '/@common/WindowParams';
import type { PlayerWindowParams, WindowParams } from '/@common/WindowParams';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:wnd`);
const isDevRuntime = import.meta.env.DEV && !app.isPackaged;

let isQuitting = false;

app.once('before-quit', () => {
  isQuitting = true;
});

let mainWindow: ManagedWindow | null = null;
const mainWindowDeferred = new Deferred<ManagedWindow>();
export default mainWindowDeferred.promise;

export const waitWebContents = (): Promise<WebContents> =>
  mainWindowDeferred.promise.then(
    ({ webContents }) =>
      new Promise(resolve => {
        if (webContents.isLoading()) webContents.on('did-finish-load', () => resolve(webContents));
        else resolve(webContents);
      }),
  );

const gmibPreload = join(__dirname, '../../preload/dist/gmib.cjs');
// const playerPreload = join(__dirname, '../../playerPreload/dist/index.cjs');

const getVisibleWindowParams = (): WindowParams[] =>
  getTabbedWindowItems()
    .map(({ id }) => store.get(id))
    .filter((params): params is WindowParams => params !== undefined);

const isLocalPlayer = (params: WindowParams): params is PlayerWindowParams =>
  isPlayer(params) && params.host === 'localhost';

const shouldPersistHiddenLocalGmib = (closingId: number): boolean => {
  const remaining = getVisibleWindowParams().filter(params => params.id !== closingId);
  return remaining.length > 0 && remaining.every(isLocalPlayer);
};

export const persistLocalWindowState = (): void => {
  const visible = getVisibleWindowParams();
  const localPlayerTabs = visible.filter(isLocalPlayer).map(({ playerId }) => playerId);
  const hasLocalGmib = visible.some(params => isGmib(params) && params.host === 'localhost');
  const onlyLocalPlayers = visible.length > 0 && visible.every(isLocalPlayer);

  localConfig.set('localPlayerTabs', localPlayerTabs);
  localConfig.set('localGmibHidden', !hasLocalGmib && onlyLocalPlayers);
};

export const hasPersistedLocalTabs = (): boolean =>
  !localConfig.get('localGmibHidden') || (localConfig.get('localPlayerTabs')?.length ?? 0) > 0;

export const createAppWindow = (
  nibusPort = +(process.env['NIBUS_PORT'] ?? 9001),
  address = 'localhost',
  name?: string,
): ManagedWindow => {
  const isLocal = !address || address === 'localhost';
  const browserWindow = createTabbedWindow(
    `${name ?? 'gmib'} (${address})` /* getTitle(port, hostName) */,
    gmibPreload,
  );
  if (isLocal) {
    browserWindow.once('ready-to-show', () => {
      if (!localConfig.get('autostart') && !localConfig.get('localGmibHidden')) {
        browserWindow.show();
        // The window may freeze from time to time at startup on Windows
        setTimeout(() => browserWindow.show(), 100);
      }
      browserWindow.webContents.on('devtools-opened', () => {
        browserWindow.focus();
        setImmediate(() => {
          browserWindow.focus();
        });
      });
    });
  }
  const query = `port=${nibusPort}${address ? `&host=${address}` : ''}`;
  const pageUrl =
    isDevRuntime && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? `${import.meta.env.VITE_DEV_SERVER_URL}?${query}`
      : `http://localhost:${nibusPort + 1}/index.html?${query}`;
  // : new URL(`../renderer/dist/index.html?${query}`, `file://${__dirname}`).toString();

  browserWindow.loadURL(pageUrl).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    debug(`error while load main window ${pageUrl}: ${msg}`);
  });
  browserWindow.webContents.on('render-process-gone', (event, details) => {
    debug(`<<<<CRASH>>>>: renderer process gone: ${details.reason} (${details.exitCode})`);
    if (
      import.meta.env.PROD &&
      !isQuitting &&
      ![/* 'clean-exit', */ 'killed'].includes(details.reason)
    ) {
      debug('relaunch...');
      relaunch();
    }
  });
  void registerGmib(browserWindow, { host: address, nibusPort });
  if (isLocal && localConfig.get('localGmibHidden')) browserWindow.hide();
  browserWindow.on('close', event => {
    const closeEvent = event as CloseEvent;
    if (isLocal && !isQuitting && !needRestart()) {
      if (getTabbedWindowItems().length <= 1) return;
      // Keep the main GMIB instance alive so it can be reopened from the menu.
      closeEvent.preventDefault();
      localConfig.set('localGmibHidden', shouldPersistHiddenLocalGmib(browserWindow.id));
      browserWindow.hide();
      return;
    }
    if (isLocal) {
      getAllScreenParams().forEach(({ id }) => BrowserWindow.fromId(id)?.close());
      mainWindow = null;
    }
  });
  return browserWindow;
};

export const createMainWindow = (): ManagedWindow => {
  if (!hasPersistedLocalTabs()) localConfig.set('localGmibHidden', false);
  if (!mainWindow) {
    const browserWindow = (mainWindow = createAppWindow());
    // browserWindow.on('close', event => {
    //   if (
    //     import.meta.env.PROD &&
    //     !needRestart() &&
    //     !isQuitting &&
    //     (localConfig.get('autostart') ||
    //       getPlayerParams().some(params => params.parent.id === browserWindow.id) ||
    //       getAllGmibParams().length > 1)
    //   ) {
    //     event.preventDefault();
    //     browserWindow.hide();
    //   } else {
    //     getAllScreenParams().forEach(({ id }) => BrowserWindow.fromId(id)?.close());
    //     mainWindow = null;
    //   }
    //   return false;
    // });
    mainWindowDeferred.resolve(browserWindow);
  }
  return mainWindow;
};

export const activateMainWindow = (): ManagedWindow => {
  localConfig.set('localGmibHidden', false);
  const browserWindow = createMainWindow();
  browserWindow.show();
  browserWindow.focus();
  return browserWindow;
};

export const getMainWindow = (): ManagedWindow | null => mainWindow;

export function createTestWindow(
  width: number,
  height: number,
  x: number,
  y: number,
  preload?: string,
): BrowserWindow {
  // Все переопределяется в openHandler.ts Это не так!
  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    // backgroundColor: '#000',
    focusable: false,
    fullscreenable: false,
    // simpleFullscreen: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    transparent: true,
    roundedCorners: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      // nativeWindowOpen: true,
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like iframe or Electron's BrowserView. https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload,
    },
  });

  window.setAlwaysOnTop(true, 'screen-saver');
  window.on('show', () => {
    window.setAlwaysOnTop(true, 'screen-saver');
    window.moveTop();
  });

  if (isDevRuntime && preload) {
    window.webContents.once('did-frame-finish-load', () => {
      window.webContents.openDevTools();
    });
  }

  window.once('ready-to-show', () => {
    window.show();
  });
  let saveBlocker = 0;
  window.on('show', () => {
    if (!powerSaveBlocker.isStarted(saveBlocker)) {
      saveBlocker = powerSaveBlocker.start('prevent-display-sleep');
    }
  });
  window.on('hide', () => {
    if (powerSaveBlocker.isStarted(saveBlocker)) {
      powerSaveBlocker.stop(saveBlocker);
    }
  });
  return window;
}
