import { app } from 'electron';

import debugFactory from 'debug';

import './security-restrictions';
import './initlog';
import localConfig from './localConfig';
import './config';
import './db';
import './nibus';
import './mdns';
import './tray';
import './linux';
import './dialogs';
import { createMainWindow } from './mainWindow';

// import {REDUX_DEVTOOLS} from 'electron-devtools-installer';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:main`);
// debug(`Starting ${__filename}|${process.pid}|${new Error().stack}...`);
debug(`local-config: ${localConfig.path}`);
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
    .then(() => import('electron-devtools-installer'))
    .then(({ default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS }) =>
      installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
        loadExtensionOptions: {
          allowFileAccess: true,
          enableJavascriptSourceMaps: false,
        },
      }),
    )
    .catch(e => debug(`Failed install extension: ${(e as Error).message}`));
}

/**
 * Create app window when background process will be ready
 */
app
  .whenReady()
  .then(createMainWindow)
  .catch(e => debug(`Failed create window: ${(e as Error).message}`));

/**
 * Check new app version in production mode only
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import('electron-updater'))
    .then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
    .catch(e => debug(`Failed check updates: ${e.message}`));
}
