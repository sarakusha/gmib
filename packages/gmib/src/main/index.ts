/* eslint-disable import/first */
/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

process.env.NIBUS_LOG = 'nibus-all.log';

import type { NibusService } from '@nibus/cli';
import { app, BrowserWindow, dialog, Display, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import Bonjour, { RemoteService } from 'bonjour-hap';
import { isIPv4 } from 'net';
import os from 'os';
import path from 'path';
import { Tail } from 'tail';
import { URLSearchParams } from 'url';
import fs from 'fs';
import readline from 'readline';
import isEqual from 'lodash/isEqual';
import uniqBy from 'lodash/uniqBy';
import config, { Config, Screen, Page } from '../util/config';
import { getRemoteLabel, getTitle, notEmpty, RemoteHost } from '../util/helpers';
import { updateTray } from './tray';
import localConfig, { CustomHost } from '../util/localConfig';
import getAllDisplays from './getAllDisplays';
import { linuxAutostart } from './linux';
import {
  addRemoteFactory,
  CreateWindow,
  removeRemote,
  setRemoteEditClick,
  setRemotesFactory,
  updateMenu,
} from './mainMenu';

import windows, { showAll } from './windows';
import debugFactory, { log } from '../util/debug';

const USE_REACT_REFRESH_WEBPACK = true;
const bonjour = Bonjour();

let currentTest: string | undefined;

let service: NibusService | null = null;

let isQuiting = false;

log.log(`LOGGER ${log.transports.file.getFile().path}, DEBUG: ${process.env.DEBUG}`);
// log.log(`${process.env.PORTABLE_EXECUTABLE_DIR}, ${app.getAppPath()}, ${app.getPath('exe')}`);
autoUpdater.logger = log;

const debug = debugFactory('gmib:main');

const interfaces = Object.values(os.networkInterfaces()).filter(notEmpty);

const localAddresses = ([] as os.NetworkInterfaceInfo[])
  .concat(...interfaces)
  .map(({ address }) => address);

const mdnsBrowser = bonjour.find({ type: 'nibus' });
const tail = new Tail(log.transports.file.getFile().path);
tail.on('line', line => {
  service?.server?.broadcast('log', line);
});

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let testWindow: BrowserWindow | null;

const defaultScreen: Required<Screen> = {
  width: 640,
  height: 320,
  moduleHres: 40,
  moduleVres: 40,
  x: 0,
  y: 0,
  display: true,
  addresses: [],
  dirh: false,
  dirv: false,
  borderTop: 0,
  borderBottom: 0,
  borderLeft: 0,
  borderRight: 0,
};

let currentScreen = defaultScreen;

const closeNibus = (): void => {
  if (service) {
    try {
      service.stop();
      service = null;
    } catch (e) {
      log.error('error while close nibus');
    }
  }
};

const pickRemoteService = (svc: RemoteService): RemoteHost | undefined => {
  if (!svc.addresses) {
    return undefined;
  }
  const addresses = svc.addresses.filter(
    address => !localAddresses.includes(address) && isIPv4(address)
  );
  if (addresses.length === 0) return undefined;
  const { port, name, host, txt } = svc;
  return {
    host: host.replace(/\.local\.?$/, ''),
    name,
    version: txt.version ?? 'N/A',
    address: addresses[0],
    port,
  };
};

const register = (svc: RemoteService, window = mainWindow): void => {
  const remote = pickRemoteService(svc);
  if (remote) {
    debug(`${!!mainWindow} serviceUp ${JSON.stringify(remote)}}`);
    window?.webContents.send('serviceUp', remote);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    addRemote(remote.port, remote.address);
  }
};

async function createWindow(
  port = +(process.env.NIBUS_PORT ?? 9001),
  host?: string,
  random = false
): Promise<BrowserWindow> {
  const size = {
    width: 800,
    height: 600,
  };
  const display = screen.getPrimaryDisplay().workAreaSize;
  const pos = random
    ? {
        x: Math.round(Math.random() * Math.max(0, display.width - size.width)),
        y: Math.round(Math.random() * Math.max(0, display.height - size.height)),
      }
    : {};
  const window = new BrowserWindow({
    ...size,
    ...pos,
    backgroundColor: '#fff', // Лучше сглаживание не некоторых экранах
    title: getTitle(port, host),
    skipTaskbar: true,
    show: false,
    useContentSize: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      worldSafeExecuteJavaScript: true,
      enableRemoteModule: false,
    },
  });

  windows.add(window);

  window.on('closed', () => {
    windows.delete(window);
    if (mainWindow === window) {
      mainWindow = null;
      if (testWindow) {
        testWindow.close();
      }
    }
  });
  if (!host) {
    window.once('ready-to-show', () => {
      setRemoteEditClick(() => window.webContents.send('editRemoteHosts'));
      // Нужно немного подождать
      setTimeout(() => {
        debug(`register remotes: ${mdnsBrowser.services.length}`);
        mdnsBrowser.services.forEach(svc => register(svc, window));
      }, 100);
      // process.platform === 'linux' && window.show();
    });

    window.webContents.on('devtools-opened', () => {
      window.focus();
      setImmediate(() => {
        window.focus();
      });
    });

    /*
    if (isDevelopment) {
      window.webContents.once('did-frame-finish-load', () => {
        window.webContents.openDevTools();
      });
    }
    */

    if (isDevelopment) {
      const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = await import(
        'electron-devtools-installer'
      );
      // REACT_DEVELOPER_TOOLS несовместим с ReactRefreshWebpackPlugin в webpack.renderer.additions.js
      const name = await installExtension(
        USE_REACT_REFRESH_WEBPACK ? [REDUX_DEVTOOLS] : [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS]
      );
      debug(`Added Extension:  ${name}`);
    }
  }

  window.on('show', () => {
    window.setSkipTaskbar(false);
    return false;
  });
  window.on('hide', () => {
    window.setSkipTaskbar(true);
    return false;
  });
  window.on('minimize', event => {
    event.preventDefault();
    window.hide();
    return false;
  });
  const query = `port=${port}${host ? `&host=${host}` : ''}`;

  await window.loadURL(
    isDevelopment
      ? `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?${query}`
      : `file://${__dirname}/index.html?${query}`
  );

  return window;
}

const create: CreateWindow = (port, host) => createWindow(port, host, true);
const addRemote = addRemoteFactory(create);
const setRemotes = setRemotesFactory(create);

function createTestWindow(): BrowserWindow {
  const { width, height, x = 0, y = 0 } = currentScreen;
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
    hasShadow: false,
    transparent: true,
    // Еще не работает
    // roundedCorners: false,
    webPreferences: {
      // nodeIntegration: true,
      contextIsolation: true,
      worldSafeExecuteJavaScript: true,
      enableRemoteModule: false,
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
  window.once('ready-to-show', () => window.show());
  process.platform === 'win32' || window.setIgnoreMouseEvents(true);
  return window;
}

const reloadTest = (id?: string): void => {
  currentTest = id;
  const tests = config.get('tests');
  const test = id ? tests.find(item => item.id === id) : undefined;
  if (!testWindow) {
    testWindow = createTestWindow();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    updateScreen();
  }
  if (!test || !test.url) {
    testWindow.hide();
    return;
  }

  const url = test.permanent
    ? `${test.url}?${new URLSearchParams(
        Object.entries(currentScreen)
          .filter(([, value]) => value !== undefined)
          .map<[string, string]>(([name, value]) => [name, value!.toString()])
      )}`
    : test.url;

  testWindow.loadURL(url).catch(e => {
    log.error('error while load test', e.message);
  });
  testWindow.show();
};

// quit application when all windows are closed
app.on('window-all-closed', () => {
  isQuiting = true;
  closeNibus();
  debug('App closed');
  app.quit();
});

/*
app.on('activate', async () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = await createWindow();
  }
});
*/

const createMainWindow = async (): Promise<BrowserWindow> => {
  if (!mainWindow) {
    mainWindow = await createWindow();
    mainWindow.on('close', event => {
      if (!isQuiting && localConfig.get('autostart')) {
        event.preventDefault();
        mainWindow?.hide();
      }
      return false;
    });
  }
  return mainWindow;
};

const updateRemotes = (hosts: CustomHost[] | undefined): void => {
  // debug(`hosts: ${JSON.stringify(hosts)}`);
  const remotes: CustomHost[] = uniqBy(
    [...mdnsBrowser.services.map(pickRemoteService).filter(notEmpty), ...(hosts ?? [])],
    ({ port, address }) => getRemoteLabel(port, address)
  );
  // debug(`remotes: ${JSON.stringify(remotes)}`);
  setRemotes(remotes);
};

localConfig.onDidChange('hosts', hosts => {
  updateRemotes(hosts);
  mdnsBrowser.update();
});

localConfig.onDidChange('autostart', (autostart = false) => {
  debug(`autostart: ${autostart}`);
  app.setLoginItemSettings({ openAtLogin: autostart, openAsHidden: true });
  linuxAutostart(autostart);
  updateMenu();
  updateTray();
});

const isCustomHost = (remote: RemoteHost): boolean => {
  const label = getRemoteLabel(remote.port, remote.address);
  const customHosts = localConfig.get('hosts');
  const custom = customHosts.find(({ port, address }) => getRemoteLabel(port, address) === label);
  return Boolean(custom);
};

const updateScreen = (): void => {
  const scr = config.get('screen') ?? {};
  const needReload =
    currentScreen.width !== scr.width ||
    currentScreen.height !== scr.height ||
    currentScreen.moduleHres !== scr.moduleHres ||
    currentScreen.moduleVres !== scr.moduleVres;
  app.whenReady().then(() => {
    currentScreen = { ...defaultScreen, ...scr };
    const primary = screen.getPrimaryDisplay();
    let display: Display | undefined;
    const displays = screen.getAllDisplays();
    if (scr.display === true) {
      display = primary;
    } else if (scr.display === false) {
      const index = displays.findIndex(({ id }) => id !== primary.id);
      if (index !== -1) display = displays[index];
    } else {
      const index = displays.findIndex(({ id }) => id.toString() === scr.display);
      if (index !== -1) display = displays[index];
    }
    if (!display) {
      debug(`Not found display ${scr.display}, ${displays.length}`);
      testWindow && testWindow.hide();
      return;
    }
    currentScreen!.x += display.bounds.x;
    currentScreen!.y += display.bounds.y;
    if (testWindow) {
      testWindow.setPosition(currentScreen.x, currentScreen.y);
      testWindow.setSize(currentScreen.width, currentScreen.height);
      currentTest && testWindow.show();
    }
    if (needReload) reloadTest(currentTest);
  });
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    showAll();
  });

  app.on('ready', async () => {
    addRemote();
    updateRemotes(localConfig.get('hosts'));
    await createMainWindow();
    isDevelopment ||
      autoUpdater
        .checkForUpdatesAndNotify()
        .catch(e => log.error('error while check for updates', e.message));
    reloadTest(config.get('test'));
    mdnsBrowser.on('up', register);
    mdnsBrowser.on('down', svc => {
      const remote = pickRemoteService(svc);
      if (remote) {
        debug(`serviceDown ${JSON.stringify(remote)}`);
        mainWindow?.webContents.send('serviceDown', remote);
        if (!isCustomHost(remote)) {
          removeRemote(remote);
        }
      }
    });
    // screen.getAllDisplays().forEach(display => debug(JSON.stringify(display)));
    const broadcastDisplays = (): void => {
      service?.server?.broadcast('displays', getAllDisplays());
      setTimeout(() => updateScreen(), 3000);
    };

    screen.on('display-added', broadcastDisplays);
    screen.on('display-removed', broadcastDisplays);
  });
}

app.once('quit', () => {
  isQuiting = true;
  closeNibus();
  mdnsBrowser.stop();
  bonjour.destroy();
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

ipcMain.on('startLocalNibus', async () => {
  try {
    const { default: svc, detectionPath } = await import('@nibus/cli/lib/service');
    service = svc;
    service.server.on('connection', socket => {
      const file = log.transports.file.getFile().path;
      if (fs.existsSync(file)) {
        const readLog = readline.createInterface({
          input: fs.createReadStream(log.transports.file.getFile().path),
        });
        readLog.on('line', line => {
          service?.server.send(socket, 'log', line);
        });
      }
      service?.server.send(socket, 'config', config.store);
      service?.server.send(socket, 'displays', getAllDisplays());
    });
    service.server.on('client:config', (_, store) => {
      try {
        config.store = store as Config;
      } catch (err) {
        sendStatusToWindow(`Error while save config: ${err.message}`, true);
      }
    });
    sendStatusToWindow('Starting local NIBUS...');
    await service.start();
    sendStatusToWindow(`NiBUS started. Detection file: ${detectionPath}`);
  } catch (e) {
    sendStatusToWindow(`Error while nibus starting ${e}`, true);
  }
});

ipcMain.on('showOpenDialogSync', (event, options: Electron.OpenDialogSyncOptions) => {
  event.returnValue = dialog.showOpenDialogSync(options);
});

ipcMain.on('showSaveDialogSync', (event, options: Electron.SaveDialogSyncOptions) => {
  event.returnValue = dialog.showSaveDialogSync(options);
});

ipcMain.on('showErrorBox', (event, title: string, content: string) => {
  dialog.showErrorBox(title, content);
});

config.onDidAnyChange(newValue => {
  service?.server?.broadcast('config', newValue);
});

config.onDidChange('test', (id: string | undefined): void => {
  if (!id) {
    testWindow && testWindow.hide();
    currentTest = undefined;
    return;
  }
  if (!testWindow) {
    testWindow = createTestWindow();
  }
  if (id !== currentTest) reloadTest(id);
  // updateScreen();
  // testWindow.setPosition(currentScreen.x || 0, currentScreen.y || 0);
  // testWindow.setSize(currentScreen.width ?? 640, currentScreen.height ?? 320);
  // testWindow.show();
});

config.onDidChange('screen', updateScreen);

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;
const reId = /<\s*meta\s*data-id=['"](.+?)['"]>/i;

(async function updateTests() {
  const testDir = path.resolve(__dirname, '../extraResources/tests');
  const filenames = (await fs.promises.readdir(testDir))
    .map(filename => path.join(testDir, filename))
    .filter(filename => !fs.lstatSync(filename).isDirectory());
  const tests = await Promise.all<Page | undefined>(
    filenames.map(async filename => {
      const html = await fs.promises.readFile(filename, 'utf-8');
      const titleMatches = html.match(reTitle);
      const idMatches = html.match(reId);
      if (!titleMatches || !idMatches) {
        console.warn('Отсутствует заголовок или id', filename);
        return undefined;
      }
      return {
        id: idMatches[1],
        title: titleMatches[1],
        url: `file://${filename}`,
        permanent: true,
      };
    })
  );
  const prev = config.get('tests');
  const items = uniqBy(tests.concat(prev), 'id');
  if (!isEqual(prev, items)) config.set('tests', items);
})();
