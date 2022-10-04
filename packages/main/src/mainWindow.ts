import { app, BrowserWindow, powerSaveBlocker } from 'electron';
import { join } from 'path';

import debugFactory from 'debug';

import createWindow from './createWindow';
import localConfig from './localConfig';
import { addRemoteFactory, getTitle, setRemoteEditClick, setRemotesFactory } from './mainMenu';
import { closeScreens, screenWindows } from './windows';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:wnd`);

let isQuiting = false;

app.once('quit', () => {
  isQuiting = true;
});

let mainWindow: BrowserWindow | null = null;
// let mainWindowPromise: Promise<BrowserWindow> | null = null;

const gmibPreload = join(__dirname, '../../preload/dist/index.cjs');
// const playerPreload = join(__dirname, '../../playerPreload/dist/index.cjs');

export const createAppWindow = (
  port = +(process.env['NIBUS_PORT'] ?? 9001),
  host: string | undefined = undefined,
): BrowserWindow => {
  // eslint-disable-next-line no-multi-assign
  const browserWindow = createWindow(
    getTitle(port, host),
    gmibPreload,
  );
  if (!host) {
    browserWindow.once('ready-to-show', async () => {
      setRemoteEditClick(() => browserWindow.webContents.send('editRemoteHosts'));
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
  const query = `port=${port}${host ? `&host=${host}` : ''}`;
  const pageUrl =
    import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? `${import.meta.env.VITE_DEV_SERVER_URL}?${query}`
      : `http://localhost:${+(process.env['NIBUS_PORT'] ?? 9001) + 1}/index.html?${query}`;
  // : new URL(`../renderer/dist/index.html?${query}`, `file://${__dirname}`).toString();

  browserWindow.loadURL(pageUrl).catch(err => {
    debug(`error while load main window ${pageUrl}: ${err.message}`);
  });
  browserWindow.webContents.on('render-process-gone', (event, details) => {
    debug(`<<<<CRASH>>>>: renderer process gone: ${details.reason} (${details.exitCode})`);
    if (import.meta.env.PROD && !['clean-exit', 'killed'].includes(details.reason)) {
      debug('relaunch...');
      app.relaunch();
      app.quit();
    }
  });
  return browserWindow;
};

export const addRemote = addRemoteFactory(createAppWindow);
export const setRemotes = setRemotesFactory(createAppWindow);

export const createMainWindow = (): BrowserWindow => {
  if (!mainWindow) {
    // eslint-disable-next-line no-multi-assign
    const browserWindow = (mainWindow = createAppWindow());
    browserWindow.on('close', event => {
      if (!isQuiting && localConfig.get('autostart')) {
        event.preventDefault();
        browserWindow.hide();
      } else {
        closeScreens();
        mainWindow = null;
      }
      return false;
    });
  }
  return mainWindow;
};

export const getMainWindow = (): BrowserWindow | null => mainWindow;

// type FilterFlags<Base, Condition> = {
//   [Key in keyof Base]: Base[Key] extends Condition ? Key : never;
// };
//
// type SessionAPI = {
//   test(
//     SenderIndex: number,
//     PortIndex: number,
//     ScanIndex: number,
//     broadcast: boolean,
//     value: string
//   ): Promise<void>;
// };
//
// type AllowedNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];
//
// type WriteFunction<T> = (
//   SenderIndex: number,
//   PortIndex: number,
//   ScanIndex: number,
//   broadcast: boolean,
//   value: T
// ) => Promise<void>;
//
// type ValueType<T> = T extends WriteFunction<infer V> ? V : never;
// type WriteNames<T = any> = AllowedNames<SessionAPI, WriteFunction<T>>;
// type ValueTypeFromName<N extends WriteNames> = ValueType<SessionAPI[N]>;
// type x = ValueType<SessionAPI['test']>;
// type y = ValueTypeFromName<'test'>;
/**
 * Restore existing BrowserWindow or Create new BrowserWindow
 */

/*
export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}
*/

export function createTestWindow(
  width: number,
  height: number,
  x: number,
  y: number,
  preload?: string,
): BrowserWindow {
  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    backgroundColor: '#000',
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
  window.on('closed', () => {
    const [id] = [...screenWindows.entries()].find(([, [w]]) => window === w) ?? [];
    if (id) screenWindows.delete(id);
    // log.log(`close and delete screenWindow ${id}`);
    // testWindow = null;
  });
  window.once('ready-to-show', () => {
    window.show();
    window.setIgnoreMouseEvents(true);
  });
  /* process.platform === 'win32' || */
  //  window.setIgnoreMouseEvents(true);
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

// updateScreens();

// config.onDidChange('screens', updateScreens);
