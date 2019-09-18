/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  Event,
} from 'electron';
import * as path from 'path';
import { format as formatUrl } from 'url';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { TestQuery } from '../providers/TestProvider';

autoUpdater.logger = log;
log.transports.file.level = 'info';
log.transports.console.level = false;
log.info('App starting...');

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let testWindow: BrowserWindow | null;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 650,
    webPreferences: { nodeIntegration: true },
  });

  if (isDevelopment) {
    import('electron-devtools-installer').then(
      ({ default: installExtension, REACT_DEVELOPER_TOOLS }) => {
        installExtension(REACT_DEVELOPER_TOOLS)
          .then((name) => {
            window.webContents.once('did-frame-finish-load', () => {
              window.webContents.openDevTools();
              // window.webContents.on('devtools-opened', () => {
              //   window.focus();
              // });
            });
            console.log(`Added Extension:  ${name}`);
          })
          .catch(err => console.log('An error occurred: ', err));
      });
  }

  if (isDevelopment) {
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
  } else {
    window.loadURL(formatUrl({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true,
    }));
  }

  window.on('closed', () => {
    mainWindow = null;
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

  return window;
}

function createTestWindow() {
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
    // webPreferences: {
    //   webSecurity: false,
    // },
  });

  if (isDevelopment) {
    import('electron-devtools-installer').then(
      ({ default: installExtension, REACT_DEVELOPER_TOOLS }) => {
        installExtension(REACT_DEVELOPER_TOOLS)
          .then((name) => {
            window.webContents.once('did-frame-finish-load', () => {
              window.webContents.openDevTools();
            });
            console.log(`Added Extension:  ${name}`);
          })
          .catch(err => console.log('An error occurred: ', err));
      });
  }
  window.on('closed', () => testWindow = null);
  window.on('ready-to-show', () => window.show());
  process.platform === 'win32' || window.setIgnoreMouseEvents(true);
  return window;
}

const reloadTest = (pathname: string) => {
  if (!testWindow || !pathname) return;
  const { width, height, moduleHres, moduleVres } = currentQuery;

  testWindow.loadURL(formatUrl({
    pathname,
    protocol: 'file',
    query: {
      width,
      height,
      moduleHres,
      moduleVres,
    },
  }));
  currentPath = pathname;
};

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin' || isDevelopment) {
    app.quit();
  }
});

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow();
  import('./mainMenu');
  isDevelopment || autoUpdater.checkForUpdatesAndNotify();
});

function sendStatusToWindow(text: string) {
  log.info(text);
  mainWindow && mainWindow.webContents.send('message', text);
}

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
});

autoUpdater.on('error', (err) => {
  sendStatusToWindow(`Error in auto-updater. ${err}`);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
  logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`;
  sendStatusToWindow(logMessage);
});

autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
});

let currentQuery: TestQuery = {
  width: 640,
  height: 320,
  moduleHres: 40,
  moduleVres: 40,
  x: 0,
  y: 0,
};

let currentPath: string;

ipcMain.on('test:query', (event: Event, query: TestQuery) => {
  let needReload = false;
  if (testWindow) {
    if (currentQuery.width !== query.width
      || currentQuery.height !== query.height
      || currentQuery.moduleHres !== query.moduleHres
      || currentQuery.moduleVres !== query.moduleVres) {
      needReload = true;
    }
    testWindow.setPosition(query.x || 0, query.y || 0);
    testWindow.setSize(query.width, query.height);
  }
  currentQuery = query;
  needReload && reloadTest(currentPath);
});

ipcMain.on('test:show', (event: Event, path: string) => {
  if (!testWindow) {
    testWindow = createTestWindow();
  }
  if (path !== currentPath) reloadTest(path);
  testWindow.setPosition(currentQuery.x || 0, currentQuery.y || 0);
  testWindow.setSize(currentQuery.width, currentQuery.height);
  testWindow.show();
  event.returnValue = true;
});

ipcMain.on('test:hide', (event: Event) => {
  if (testWindow) {
    testWindow.hide();
  }
  return true;
});
