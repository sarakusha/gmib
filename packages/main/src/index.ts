import { app, crashReporter, globalShortcut, powerSaveBlocker } from 'electron';

// import * as Sentry from '@sentry/electron/main';
import debugFactory from 'debug';

import './security-restrictions';
import log from './initlog';
import localConfig from './localConfig';
import './config';
import './screen';
// import './nibus';
import './mdns';
import { showLast } from './tray';
import './linux';
import './dialogs';
import './express';
import './ipc';
import './rtc';
import './hid';
// import './channels';
import { activateMainWindow, createMainWindow, persistLocalWindowState } from './mainWindow';
import { installWindowOpenHandler, toggleOutputWindowsVisibility } from './openHandler';
import { startPlayerScheduler } from './playerScheduler';
import { launchPlayers } from './playerWindow';

import { fixDefault } from '/@common/helpers';

process.env['npm_package_version'] = import.meta.env.VITE_APP_VERSION;

void import('./nibus');

// import {REDUX_DEVTOOLS} from 'electron-devtools-installer';
// import.meta.env.PROD && Sentry.init({ dsn: 'https://fbd4024789d247fcb5eb2493d1aa28b6@o1412889.ingest.sentry.io/6752393' });
crashReporter.start({ uploadToServer: false });

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:main`);
const isDevRuntime = import.meta.env.DEV && !app.isPackaged;
// debug(`Starting ${__filename}|${process.pid}|${new Error().stack}...`);
debug(`local-config: ${localConfig.path}`);

let suspendBlocker = 0;
/**
 * Prevent multiple instances
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', activateMainWindow);

/**
 * Disable Hardware Acceleration for more power-save
 */
// app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (powerSaveBlocker.isStarted(suspendBlocker)) {
    powerSaveBlocker.stop(suspendBlocker);
  }

  // if (!import.meta.env.PROD || process.platform !== 'darwin') {
  app.quit();
  // }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', persistLocalWindowState);

/**
 * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
 */
app.on('activate', showLast);

/**
 */
if (isDevRuntime) {
  app
    .whenReady()

    .then(() => import('electron-extension-installer'))
    .then(({ default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS }) =>
      fixDefault(installExtension)([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
        loadExtensionOptions: {
          allowFileAccess: true,
          // enableJavascriptMaps: true,
        },
      }),
    )
    .catch(e => debug(`Failed install extension: ${(e as Error).message}`));
}

// const preload = join(__dirname, '../assets/preload.js');
/**
 * Create app window when background process will be ready
 */
app
  .whenReady()
  .then(() => {
    startPlayerScheduler();
  })
  .then(createMainWindow)
  .then(main => {
    installWindowOpenHandler(main.webContents);
    void launchPlayers();
    if (!globalShortcut.register('CommandOrControl+Alt+H', toggleOutputWindowsVisibility)) {
      debug('Failed to register output window hotkey CommandOrControl+Alt+H');
    }
  })
  .then(() => {
    if (!powerSaveBlocker.isStarted(suspendBlocker)) {
      suspendBlocker = powerSaveBlocker.start('prevent-display-sleep');
    }
  })
  .catch(e => debug(`Failed create window: ${(e as Error).message}`));

process.on('uncaughtException', error => {
  log.error(`uncaughtException: ${error.stack}`);
});
