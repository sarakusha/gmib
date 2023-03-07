/**
 * @module preload
 */

import { contextBridge } from 'electron';
// import '@sentry/electron/preload';

import type { LogLevel } from '@nibus/core';
import { machineId } from 'node-machine-id';

import * as identify from '../common/identify';
import log, { setLogLevel } from '../common/initlog';
import { setDispatch } from '../common/ipcDispatch';

import * as config from './config';
import * as db from './db';
import * as dialogs from './dialogs';
import * as nibus from './nibus';
// import * as novastar from './novastar';
import * as output from './output';

import expandTypes from '/@common/expandTypes';

let MACHINE_ID: string;
machineId().then(value => {
  MACHINE_ID = value;
});
/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */

/**
 * After analyzing the `exposeInMainWorld` calls,
 * `packages/preload/exposedInMainWorld.d.ts` file will be generated.
 * It contains all interfaces.
 * `packages/preload/exposedInMainWorld.d.ts` file is required for TS is `renderer`
 *
 * @see https://github.com/cawa-93/dts-for-context-bridge
 */

/**
 * Expose Environment versions.
 * @example
 * console.log( window.versions )
 */
contextBridge.exposeInMainWorld('versions', process.versions);
contextBridge.exposeInMainWorld('machineId', () => MACHINE_ID);
contextBridge.exposeInMainWorld('server', {
  port: +(process.env['NIBUS_PORT'] ?? 9001) + 1,
});
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
// contextBridge.exposeInMainWorld('novastar', expandTypes(novastar));
contextBridge.exposeInMainWorld('nibus', expandTypes(nibus));
contextBridge.exposeInMainWorld('config', expandTypes(config));
contextBridge.exposeInMainWorld('dialogs', expandTypes(dialogs));
contextBridge.exposeInMainWorld('db', expandTypes(db));
contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setLogLevel', (logLevel: LogLevel) => {
  setLogLevel(logLevel);
  nibus.setLogLevel(logLevel);
});
contextBridge.exposeInMainWorld('output', expandTypes(output));
contextBridge.exposeInMainWorld('identify', expandTypes(identify));
