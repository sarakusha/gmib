import type { WebContents } from 'electron';
import { app, BrowserWindow, powerSaveBlocker } from 'electron';
import { join } from 'path';

import debugFactory from 'debug';

import createWindow from './createWindow';
import localConfig from './localConfig';
import relaunch, { needRestart } from './relaunch';
import { getAllGmibParams, getAllScreenParams, getPlayerParams, registerGmib } from './windowStore';

import Deferred from '/@common/Deferred';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:wnd`);

let isQuitting = false;

app.once('quit', () => {
  isQuitting = true;
});

let mainWindow: BrowserWindow | null = null;
const mainWindowDeferred = new Deferred<BrowserWindow>();
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

export const createAppWindow = (
  nibusPort = +(process.env['NIBUS_PORT'] ?? 9001),
  address = 'localhost',
  name?: string,
): BrowserWindow => {
  // eslint-disable-next-line no-multi-assign
  const isLocal = !address || address === 'localhost';
  const browserWindow = createWindow(
    `${name ?? 'gmib'} (${address})` /* getTitle(port, hostName) */,
    gmibPreload,
  );
  if (isLocal) {
    browserWindow.once('ready-to-show', async () => {
      if (!localConfig.get('autostart')) {
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
    import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? `${import.meta.env.VITE_DEV_SERVER_URL}?${query}`
      : `http://localhost:${nibusPort + 1}/index.html?${query}`;
  // : new URL(`../renderer/dist/index.html?${query}`, `file://${__dirname}`).toString();

  browserWindow.loadURL(pageUrl).catch(err => {
    debug(`error while load main window ${pageUrl}: ${err.message}`);
  });
  browserWindow.webContents.on('render-process-gone', (event, details) => {
    debug(`<<<<CRASH>>>>: renderer process gone: ${details.reason} (${details.exitCode})`);
    if (import.meta.env.PROD && ![/* 'clean-exit', */ 'killed'].includes(details.reason)) {
      debug('relaunch...');
      relaunch();
    }
  });
  registerGmib(browserWindow, { host: address, nibusPort });
  browserWindow.on('close', event => {
    const gmibParams = getAllGmibParams();
    if (
      import.meta.env.PROD &&
      isLocal &&
      !needRestart() &&
      !isQuitting &&
      (localConfig.get('autostart') ||
        getPlayerParams().length > 0 || // .some(params => params.parent.id === browserWindow.id) ||
        gmibParams.length > 1)
    ) {
      event.preventDefault();
      browserWindow.hide();
    } else if (isLocal) {
      getAllScreenParams().forEach(({ id }) => BrowserWindow.fromId(id)?.close());
      mainWindow = null;
    } else if (gmibParams.length - 1 === 1 && mainWindow && !mainWindow.isVisible()) {
      setTimeout(() => mainWindow?.close(), 100);
    }
  });
  return browserWindow;
};

export const createMainWindow = (): BrowserWindow => {
  if (!mainWindow) {
    // eslint-disable-next-line no-multi-assign
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

export const getMainWindow = (): BrowserWindow | null => mainWindow;

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
    // fullscreen: true,
    // kiosk: true,
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

  if (import.meta.env.DEV && preload) {
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
