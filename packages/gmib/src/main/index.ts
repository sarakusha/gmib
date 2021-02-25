/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { app, BrowserWindow, ipcMain, Event, dialog } from 'electron';
import { URLSearchParams } from 'url';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import type { NibusService } from '@nibus/cli';
import { Tail } from 'tail';
import Store from 'electron-store';
import mdns from 'mdns';
import type { TestQuery } from '../store/testSlice';
import pkg from '../../package.json';

const USE_REACT_REFRESH_WEBPACK = true;

const PORT = 9000;

let currentPath: string;

let service: NibusService | null = null;

process.env.DEBUG = 'nibus:*';
process.env.DEBUG_COLORS = 'yes';
process.env.NIBUS_LOG = 'nibus-all.log';

autoUpdater.logger = log;
log.transports.file.level = 'info';
log.transports.file.fileName = process.env.NIBUS_LOG || 'gmib-main.log';
log.transports.console.level = false;

Store.initRenderer();

const ad = mdns.createAdvertisement(mdns.tcp('gmib'), PORT, {
  txtRecord: {
    version: pkg.version,
  },
});

ad.start();

const tail = new Tail(log.transports.file.getFile().path);

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let testWindow: BrowserWindow | null;

tail.on('line', line => {
  mainWindow?.webContents && mainWindow.webContents.send('log', line);
});

let currentQuery: TestQuery = {
  width: 640,
  height: 320,
  moduleHres: 40,
  moduleVres: 40,
  x: 0,
  y: 0,
};

const closeNibus = (): void => {
  if (service) {
    try {
      log.info('tray to close nibus');
      service.stop();
      service = null;
      log.info('nibus closed');
    } catch (e) {
      log.error('error while close nibus');
    }
  }
};

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 800,
    height: 650,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      worldSafeExecuteJavaScript: true,
      // enableRemoteModule: true,
    },
  });

  window.on('closed', () => {
    mainWindow = null;
    service && service.stop();
    if (testWindow) {
      testWindow.close();
    }
  });

  window.webContents.on('devtools-opened', () => {
    window.focus();
    setImmediate(() => {
      window.focus();
    });
  });

  if (isDevelopment) {
    window.webContents.once('did-frame-finish-load', () => {
      window.webContents.openDevTools();
    });
  }

  if (isDevelopment) {
    const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = await import(
      'electron-devtools-installer'
    );
    // REACT_DEVELOPER_TOOLS несовместим с ReactRefreshWebpackPlugin в webpack.renderer.additions.js
    const name = await installExtension(
      USE_REACT_REFRESH_WEBPACK ? [REDUX_DEVTOOLS] : [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS]
    );
    log.info(`Added Extension:  ${name}`);
  }

  if (isDevelopment) {
    await window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
  } else {
    await window.loadURL(`file://${__dirname}/index.html`);
  }

  return window;
}

function createTestWindow(): BrowserWindow {
  const { width, height, x = 0, y = 0 } = currentQuery;
  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    backgroundColor: '#000',
    focusable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      // nodeIntegration: true,
      contextIsolation: true,
      worldSafeExecuteJavaScript: true,
    },
    // webPreferences: {
    //   webSecurity: false,
    // },
  });

  if (isDevelopment) {
    window.webContents.once('did-frame-finish-load', () => {
      window.webContents.openDevTools();
    });
  }
  window.on('closed', () => {
    testWindow = null;
  });
  window.on('ready-to-show', () => window.show());
  process.platform === 'win32' || window.setIgnoreMouseEvents(true);
  return window;
}

const reloadTest = (pathname: string): void => {
  if (!testWindow || !pathname) return;

  testWindow
    .loadURL(
      `file://${pathname}?${new URLSearchParams(
        Object.entries(currentQuery).map<[string, string]>(([name, value]) => [
          name,
          value.toString(),
        ])
      )}`
    )
    .catch(e => {
      log.error('error while load test', e.message);
    });
  currentPath = pathname;
};

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  // if (process.platform !== 'darwin' || isDevelopment) {
  closeNibus();
  ad.stop();
  app.quit();
  log.info('App closed');
  // }
});

app.on('activate', async () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = await createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', async () => {
  mainWindow = await createMainWindow();
  import('./mainMenu');
  isDevelopment ||
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch(e => log.error('error while check for updates', e.message));
});

function sendStatusToWindow(text: string, isError = false): void {
  isError ? log.error(text) : log.info(text);
  mainWindow && mainWindow.webContents.send('message', text);
}
sendStatusToWindow('App starting...');

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
});

autoUpdater.on('update-available', () => {
  sendStatusToWindow('Update available.');
});

autoUpdater.on('update-not-available', () => {
  sendStatusToWindow('Update not available.');
});

autoUpdater.on('error', err => {
  sendStatusToWindow(`Error in auto-updater. ${err}`);
});

autoUpdater.on('download-progress', progressObj => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
  logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`;
  sendStatusToWindow(logMessage);
});

autoUpdater.on('update-downloaded', () => {
  sendStatusToWindow('Update downloaded');
});

ipcMain.on('test:query', (event: Event, query: TestQuery) => {
  let needReload = false;
  if (testWindow) {
    if (
      currentQuery.width !== query.width ||
      currentQuery.height !== query.height ||
      currentQuery.moduleHres !== query.moduleHres ||
      currentQuery.moduleVres !== query.moduleVres
    ) {
      needReload = true;
    }
    testWindow.setPosition(query.x || 0, query.y || 0);
    testWindow.setSize(query.width, query.height);
  }
  currentQuery = query;
  needReload && reloadTest(currentPath);
});

ipcMain.on('test:show', (event: Event, pathname: string) => {
  if (!testWindow) {
    testWindow = createTestWindow();
  }
  if (pathname !== currentPath) reloadTest(pathname);
  testWindow.setPosition(currentQuery.x || 0, currentQuery.y || 0);
  testWindow.setSize(currentQuery.width, currentQuery.height);
  testWindow.show();
  event.returnValue = true;
});

ipcMain.on('test:hide', () => {
  if (testWindow) {
    testWindow.hide();
  }
  return true;
});

ipcMain.on('startLocalNibus', () => {
  import('@nibus/cli/lib/service')
    .then(({ default: svc, detectionPath }) => {
      service = svc;
      sendStatusToWindow('Starting local NIBUS...');
      return service.start().then(() => {
        sendStatusToWindow(`NiBUS started. Detection file: ${detectionPath}`);
      });
    })
    .catch(e => {
      sendStatusToWindow(`Error while nibus starting ${e}`);
    });
  // import('@nata/nibus.js/lib/service/service').then(service => service.default.start());
});

// ipcMain.on('reloadNibus', () => {
//   service && service.reload();
//   // import('@nibus/cli/lib/service').then(({ default: svc }) => {
//   //   svc.reload();
//   // });
// });

ipcMain.on('showOpenDialogSync', (event, options: Electron.OpenDialogSyncOptions) => {
  event.returnValue = dialog.showOpenDialogSync(options);
});

ipcMain.on('showSaveDialogSync', (event, options: Electron.SaveDialogSyncOptions) => {
  event.returnValue = dialog.showSaveDialogSync(options);
});

ipcMain.on('showErrorBox', (event, title: string, content: string) => {
  dialog.showErrorBox(title, content);
});

ipcMain.on('autoStart', (event, open: boolean) => {
  app.setLoginItemSettings({ openAtLogin: open });
});
