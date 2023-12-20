import { app, crashReporter, powerSaveBlocker } from 'electron';

// import * as Sentry from '@sentry/electron/main';
import debugFactory from 'debug';

import './security-restrictions';
import log from './initlog';
import localConfig from './localConfig';
import './config';
import './screen';
// import './nibus';
import './mdns';
import './tray';
import './linux';
import './dialogs';
import './express';
import './ipc';
import './rtc';
// import './channels';
import { createMainWindow } from './mainWindow';
import openHandler from './openHandler';
import { launchPlayers } from './playerWindow';

import { fixDefault } from '/@common/helpers';
import { needRestart } from './relaunch';

process.env['npm_package_version'] = import.meta.env.VITE_APP_VERSION;

import('./nibus');

// import {REDUX_DEVTOOLS} from 'electron-devtools-installer';
// import.meta.env.PROD && Sentry.init({ dsn: 'https://fbd4024789d247fcb5eb2493d1aa28b6@o1412889.ingest.sentry.io/6752393' });
crashReporter.start({ uploadToServer: false });

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:main`);
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
app.on('second-instance', createMainWindow);

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

/**
 * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
 */
app.on('activate', createMainWindow);

/**
 */
if (import.meta.env.DEV) {
  app
    .whenReady()
    // eslint-disable-next-line import/no-extraneous-dependencies
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
  .then(createMainWindow)
  .then(main => {
    main.webContents.setWindowOpenHandler(openHandler);
    launchPlayers();
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

setTimeout(() => {
  needRestart(true);
  app.quit();
}, 1000 * 60 * 60 * 2).unref();
