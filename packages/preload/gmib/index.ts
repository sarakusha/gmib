/**
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

import type { LogLevel } from '@nibus/core';

import * as identify from '../common/identify';
import log, { setLogLevel } from '../common/initlog';
import ipcDispatch, { setDispatch } from '../common/ipcDispatch';

import * as config from './config';
// import * as db from './db';
import * as dialogs from './dialogs';
import * as nibus from './nibus';
// import * as output from './output';
import * as mediaSource from './mediaSource';

import './hid';

import expandTypes from '/@common/expandTypes';
import { hashCode } from '/@common/helpers';
import type { GmibWindowParams } from '/@common/WindowParams';
import { setFocused } from '/@renderer/store/currentSlice';

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
contextBridge.exposeInMainWorld('server', {
  port: +(process.env['NIBUS_PORT'] ?? 9001) + 1,
});
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
// contextBridge.exposeInMainWorld('novastar', expandTypes(novastar));
contextBridge.exposeInMainWorld('nibus', expandTypes(nibus));
contextBridge.exposeInMainWorld('config', expandTypes(config));
contextBridge.exposeInMainWorld('dialogs', expandTypes(dialogs));
// contextBridge.exposeInMainWorld('db', expandTypes(db));
contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setLogLevel', (logLevel: LogLevel) => {
  setLogLevel(logLevel);
  nibus.setLogLevel(logLevel);
});
// contextBridge.exposeInMainWorld('output', expandTypes(output));
contextBridge.exposeInMainWorld('identify', expandTypes(identify));

// contextBridge.exposeInMainWorld('activateLicense', (key: string, name?: string): Promise<true | string> =>
//   ipcRenderer.invoke('activateLicense', key, name),
// );

// TODO: Возможно убрать?
// contextBridge.exposeInMainWorld('electronAPI', {
//   handleHost: (listener: (event: IpcRendererEvent) => void) =>
//     ipcRenderer.on('get-host-options', listener),
// });

const gmibParams = new Promise<GmibWindowParams>(resolve => {
  ipcRenderer.once('gmib-params', (_, params: GmibWindowParams) => {
    resolve(params);
  });
});

const onReady = async () => {
  let machineId = await ipcRenderer.invoke('getMachineId');
  if (typeof machineId !== 'string') {
    machineId = (await gmibParams).machineId;
  }
  // console.log(machineId, typeof machineId);
  if (typeof machineId === 'string') {
    // console.log({ machineId, hash: hashCode(machineId).toString(16) });
    document.body.classList.add(`gmib-${hashCode(machineId).toString(16)}`);
  } else {
    log.error('Failed to get machine id');
  }
};

if (document.readyState === 'loading') {
  // ещё загружается, ждём события
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  // DOM готов!
  onReady();
}

ipcRenderer.on('focus', (_, focused: boolean) => {
  ipcDispatch(setFocused(focused));
});

// contextBridge.exposeInMainWorld('license', () =>
//   gmibParams.then(({ plan, renew, key }) => ({ plan, renew, key })),
// );

contextBridge.exposeInMainWorld(
  'initializeNovastar',
  (): Promise<boolean> => gmibParams.then(({ useProxy }) => Boolean(useProxy)),
);

contextBridge.exposeInMainWorld('mediaSource', expandTypes(mediaSource));
