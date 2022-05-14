import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { URL } from 'url';

// import debugFactory from 'debug';

import localConfig from './localConfig';
import type { CreateWindow } from './mainMenu';
import { addRemoteFactory, getTitle, setRemoteEditClick, setRemotesFactory } from './mainMenu';
import { closeScreens } from './windows';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:wnd`);

const createWindow: CreateWindow = async (
  port = +(process.env['NIBUS_PORT'] ?? 9001),
  host: string | undefined = undefined,
  random = true,
) => {
  const size = {
    width: 800,
    height: 620,
  };
  const display = screen.getPrimaryDisplay().workAreaSize;
  const pos = random
    ? {
        x: Math.round(Math.random() * Math.max(0, display.width - size.width)),
        y: Math.round(Math.random() * Math.max(0, display.height - size.height)),
      }
    : {};
  const browserWindow = new BrowserWindow({
    show: false, // Use 'ready-to-show' event to show window
    skipTaskbar: true,
    backgroundColor: '#fff',
    useContentSize: true,
    ...pos,
    ...size,
    title: getTitle(port, host),
    webPreferences: {
      nativeWindowOpen: true,
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like iframe or Electron's BrowserView. https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(__dirname, '../../preload/dist/index.cjs'),
    },
  });

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  if (!host) {
    browserWindow.once('ready-to-show', async () => {
      setRemoteEditClick(() => browserWindow?.webContents.send('editRemoteHosts'));
      if (!localConfig.get('autostart')) {
        browserWindow?.show();
        // The window may freeze from time to time at startup on Windows
        setTimeout(() => browserWindow?.show(), 100);
      }

      /*
      if (import.meta.env.DEV) {
        const {
          default: installExtension,
          // REACT_DEVELOPER_TOOLS,
          REDUX_DEVTOOLS,
          // eslint-disable-next-line import/no-extraneous-dependencies
        } = await import('electron-devtools-installer');
        const name = await installExtension([/!* REACT_DEVELOPER_TOOLS, *!/ REDUX_DEVTOOLS]);
        debug(`Added Extension:  ${name}`);
        // browserWindow?.webContents.openDevTools();
      }
*/

      browserWindow.webContents.on('devtools-opened', () => {
        browserWindow.focus();
        setImmediate(() => {
          browserWindow.focus();
        });
      });
    });
  }
  browserWindow.on('show', () => {
    browserWindow.setSkipTaskbar(false);
    browserWindow.focus();
    return false;
  });
  browserWindow.on('hide', () => {
    browserWindow.setSkipTaskbar(true);
    return false;
  });
  browserWindow.on('minimize', (event: Event) => {
    event.preventDefault();
    browserWindow.hide();
    return false;
  });

  const query = `port=${port}${host ? `&host=${host}` : ''}`;
  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test
   */
  const pageUrl =
    import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? `${import.meta.env.VITE_DEV_SERVER_URL}?${query}`
      : new URL(`../renderer/dist/index.html?${query}`, `file://${__dirname}`).toString();

  await browserWindow.loadURL(pageUrl);

  return browserWindow;
};

export const addRemote = addRemoteFactory(createWindow);
export const setRemotes = setRemotesFactory(createWindow);

let isQuiting = false;

app.once('quit', () => {
  isQuiting = true;
});

// let mainWindow: BrowserWindow | null = null;
let mainWindowPromise: Promise<BrowserWindow> | null = null;

export const createMainWindow = async (): Promise<BrowserWindow> => {
  if (!mainWindowPromise) {
    mainWindowPromise = createWindow().then(mainWindow => {
      mainWindow.on('close', event => {
        if (!isQuiting && localConfig.get('autostart')) {
          event.preventDefault();
          mainWindow?.hide();
        } else {
          closeScreens();
          mainWindowPromise = null;
        }
        return false;
      });
      return mainWindow;
    });
  }
  return mainWindowPromise;
};

export const getMainWindow = (): Promise<BrowserWindow | null> =>
  mainWindowPromise ?? Promise.resolve(null);

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
