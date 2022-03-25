/* eslint-disable import/first */
/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Bonjour, { RemoteService } from 'bonjour-hap';
import debugFactory from 'debug';
import { BrowserWindow, Display, app, dialog, ipcMain, powerSaveBlocker, screen } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import isEqual from 'lodash/isEqual';
import uniqBy from 'lodash/uniqBy';
import { AddressInfo, isIPv4 } from 'net';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { Tail } from 'tail';
import { URLSearchParams } from 'url';
import tcpPortUsed from 'tcp-port-used';
import type { NibusService } from '@nibus/cli';

import { Config, Page, Screen, defaultScreen } from '../util/config';
import {
  RemoteHost,
  findById,
  getRemoteLabel,
  getTitle,
  notEmpty,
  toErrorMessage,
} from '../util/helpers';
import localConfig, { CustomHost } from '../util/localConfig';
import config from './config';
import { getBrightnessHistory } from './db';
import getAllDisplays from './getAllDisplays';
import { linuxAutostart } from './linux';
import {
  CreateWindow,
  addRemoteFactory,
  removeRemote,
  setRemoteEditClick,
  setRemotesFactory,
  updateMenu,
} from './mainMenu';
import { updateTray } from './tray';
import windows, { closeScreens, screenWindows, showAll } from './windows';
import server from './server';

const USE_REACT_REFRESH_WEBPACK = true;
const bonjour = Bonjour();

let service: NibusService | null = null;

let isQuiting = false;

// const logger: Transport = message => service?.server?.broadcast('log', message);
// logger.level = 'info';
// log.transports.logger = logger;
log.transports.file.level = 'info';
log.transports.file.fileName = 'gmib.log';
log.transports.console.level = false;

process.env.DEBUG_COLORS = '1';
debugFactory.log = log.log.bind(log);
debugFactory.enable(process.env.DEBUG!);

const tail = new Tail(log.transports.file.getFile().path);
tail.on('line', line => service?.server?.broadcast('log', line));

process.nextTick(() =>
  log.log(`Log: ${log.transports.file.getFile().path}, DEBUG=${process.env.DEBUG}`)
);
// log.log(`${process.env.PORTABLE_EXECUTABLE_DIR}, ${app.getAppPath()}, ${app.getPath('exe')}`);
autoUpdater.logger = log;

const debug = debugFactory('gmib:main');

const interfaces = Object.values(os.networkInterfaces()).filter(notEmpty);

const localAddresses = ([] as os.NetworkInterfaceInfo[])
  .concat(...interfaces)
  .map(({ address }) => address);

const mdnsBrowser = bonjour.find({ type: 'nibus' });

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

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
    debug(`serviceUp ${JSON.stringify(remote)}}`);
    window?.webContents.send('serviceUp', remote);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    addRemote(remote.port, remote.address);
  }
};

async function createWindow(
  port = +(process.env.NIBUS_PORT ?? 9001),
  host: string | undefined = undefined,
  random = false
): Promise<BrowserWindow> {
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
  const window = new BrowserWindow({
    ...size,
    ...pos,
    backgroundColor: '#fff', // Лучше сглаживание на некоторых экранах
    title: getTitle(port, host),
    skipTaskbar: true,
    show: false, // !localConfig.get('autostart'),
    useContentSize: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      //      worldSafeExecuteJavaScript: true,
      //      enableRemoteModule: false,
    },
  });

  windows.add(window);

  window.on('closed', () => {
    windows.delete(window);
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  if (!host) {
    window.once('ready-to-show', () => {
      setRemoteEditClick(() => window.webContents.send('editRemoteHosts'));
      // Нужно немного подождать
      setTimeout(() => {
        // debug(`register remotes: ${mdnsBrowser.services.length}`);
        mdnsBrowser.services.forEach(svc => register(svc, window));
      }, 100).unref();
      if (!localConfig.get('autostart')) {
        window.show();
        // The window may freeze from time to time at startup on Windows
        setTimeout(() => window.show(), 100);
      }
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
      // eslint-disable-next-line import/no-extraneous-dependencies
      const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = await import(
        // eslint-disable-next-line import/no-extraneous-dependencies
        'electron-devtools-installer'
      );
      // REACT_DEVELOPER_TOOLS несовместим с ReactRefreshWebpackPlugin в
      // webpack.renderer.additions.js
      const name = await installExtension(
        USE_REACT_REFRESH_WEBPACK ? [REDUX_DEVTOOLS] : [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS]
      );
      debug(`Added Extension:  ${name}`);
    }
  }

  window.on('show', () => {
    window.setSkipTaskbar(false);
    window.focus();
    return false;
  });
  window.on('hide', () => {
    window.setSkipTaskbar(true);
    return false;
  });
  window.on('minimize', (event: Event) => {
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

function createTestWindow(width: number, height: number, x: number, y: number): BrowserWindow {
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
    roundedCorners: false,
    webPreferences: {
      // nodeIntegration: true,
      contextIsolation: true,
      //      worldSafeExecuteJavaScript: true,
      //      enableRemoteModule: false,
    },
    // webPreferences: {
    //   webSecurity: false,
    // },
  });

  /*
  if (isDevelopment) {
    window.webContents.once('did-frame-finish-load', () => {
      window.webContents.openDevTools();
    });
  }
*/
  window.on('closed', () => {
    const [id] = [...screenWindows.entries()].find(([, w]) => window === w) ?? [];
    if (id) screenWindows.delete(id);
    log.log(`close and delete screenWindow ${id}`);
    // testWindow = null;
  });
  window.once('ready-to-show', () => {
    window.show();
    window.setIgnoreMouseEvents(true);
  });
  /* process.platform === 'win32' ||*/
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

const createMainWindow = async (): Promise<BrowserWindow> => {
  if (!mainWindow) {
    mainWindow = await createWindow();
    mainWindow.on('close', event => {
      if (!isQuiting && localConfig.get('autostart')) {
        event.preventDefault();
        mainWindow?.hide();
      } else {
        closeScreens();
        mainWindow = null;
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
  app.setLoginItemSettings({
    openAtLogin: autostart,
    openAsHidden: true,
  });
  linuxAutostart(autostart);
  updateMenu();
  updateTray();
});

let lastHealth: number | undefined;

localConfig.onDidChange('health', health => {
  if (health && health.timestamp !== lastHealth) {
    lastHealth = health.timestamp;
    service?.server.broadcast('health', health);
  }
});

const isCustomHost = (remote: RemoteHost): boolean => {
  const label = getRemoteLabel(remote.port, remote.address);
  const customHosts = localConfig.get('hosts');
  const custom = customHosts.find(({ port, address }) => getRemoteLabel(port, address) === label);
  return Boolean(custom);
};

const impScreenProps: ReadonlyArray<keyof Screen> = [
  'output',
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'width',
  'height',
  'moduleHres',
  'moduleVres',
] as const;

const updateScreens = (newValue?: Screen[], oldValue?: Screen[]): void => {
  app.whenReady().then(() => {
    const screens = newValue ?? config.get('screens');
    // log.log(JSON.stringify(newValue));
    // log.log(JSON.stringify(oldValue));
    const keys = [...new Set<string>([...screenWindows.keys(), ...screens.map(({ id }) => id)])];
    const primary = screen.getPrimaryDisplay();
    const displays = screen.getAllDisplays();
    // log.log(`keys ${keys.join()}`);
    keys.forEach(id => {
      const curScreen = findById(screens, id);
      let window = screenWindows.get(id);
      if (!curScreen) {
        if (window) {
          window.close();
          screenWindows.delete(id);
        }
        return;
      }
      let display: Display | undefined;
      if (curScreen.display === true) {
        display = primary;
      } else if (curScreen.display === false) {
        const index = displays.findIndex(disp => disp.id !== primary.id);
        if (index !== -1) display = displays[index];
      } else {
        const index = displays.findIndex(disp => disp.id.toString() === curScreen.display);
        if (index !== -1) display = displays[index];
      }
      const page =
        curScreen.output && config.get('pages').find(item => item.id === curScreen.output);
      if (!display || !page) {
        debug(`Not found display ${curScreen.display}, ${displays.length}`);
        window?.hide();
        return;
      }
      const prevScreen = findById(oldValue, id);
      const scr = { ...defaultScreen, ...curScreen };
      const x = scr.x + display.bounds.x;
      const y = scr.y + display.bounds.y;
      const needReload =
        !prevScreen ||
        !window ||
        impScreenProps.reduce<boolean>(
          (res, name) => res || curScreen[name] !== prevScreen[name],
          false
        );
      const url = page.permanent
        ? `${page.url}?${new URLSearchParams(
            impScreenProps
              .map<[string, string] | undefined>(name => {
                const value = curScreen[name];
                return value !== undefined ? [name, value.toString()] : undefined;
              })
              .concat([['port', (server.address() as AddressInfo).port.toString()]])
              .filter(notEmpty)
          )}`
        : page.url;

      if (!window) {
        window = createTestWindow(scr.width, scr.height, x, y);
        screenWindows.set(scr.id, window);
        const contents = window.webContents;
        contents.on('did-fail-load', (
          event,
          errorCode,
          errorDescription /* , validatedURL, isMainFrame*/
        ) => {
          debug(
            `Loading error. url: ${url}, errorCode: ${errorCode}, errorDescription: ${errorDescription}`
          );
          /* ERR_FILE_NOT_FOUND */
          if (errorCode !== -6) setTimeout(() => contents.reload(), 5000).unref();
        });
      } else {
        window.setPosition(x, y);
        window.setSize(scr.width, scr.height);
      }
      needReload && url && window.loadURL(url);
      window.show();
    });
  });
};

updateScreens();

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
    // reloadTest(config.get('test'));
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
      setTimeout(() => {
        const screens = config.get('screens');
        updateScreens(screens, screens);
      }, 3000).unref();
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

sendStatusToWindow('>>>>> App starts');

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
  sendStatusToWindow(`Error in auto-updater. ${err.message}`);
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

const startLocalNibus = async (): Promise<void> => {
  const inUse = await tcpPortUsed.check(+(process.env.NIBUS_PORT ?? 9001));
  if (inUse) {
    console.warn('Port already in use');
    return;
  }
  try {
    const { default: svc } = await import('@nibus/cli/lib/service');
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
    service.server.on('client:config', (socket, store) => {
      try {
        config.store = store as Config;
      } catch (err) {
        sendStatusToWindow(`Error while save config: ${toErrorMessage(err)}`, true);
        service?.server.send(socket, 'config', config.store);
      }
    });
    service.server.on('client:getBrightnessHistory', (socket, dt) => {
      getBrightnessHistory(dt).then(rows =>
        service?.server.send(socket, 'brightnessHistory', rows)
      );
    });
    sendStatusToWindow('Starting local NIBUS...');
    await service.start();
    // sendStatusToWindow(`NiBUS started. Detection file: ${detectionPath}`);
  } catch (e) {
    sendStatusToWindow(`Error while nibus starting ${e}`, true);
  }
};

startLocalNibus();

ipcMain.on('startLocalNibus', startLocalNibus);

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

/*
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
*/

config.onDidChange('screens', updateScreens);

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;
const reId = /<\s*meta\s*data-id=['"](.+?)['"]>/i;

async function updateTestsImpl(): Promise<void> {
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
  const prev = config.get('pages');
  const items = uniqBy(tests.concat(prev), 'id');
  if (!isEqual(prev, items)) config.set('pages', items);
}

const updateTests = (): void => {
  updateTestsImpl().catch(err => debug(`error while update tests ${err.message}`));
};

updateTests();

config.onDidChange('pages', newValue => {
  if (newValue?.some(({ permanent }) => permanent)) return;
  process.nextTick(() => updateTests());
});
