/**
 * @module preload
 */

import { ipcRenderer } from 'electron';

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
import * as plugins from './plugins';

import './hid';

import exposeApi from '../common/exposeApi';
import { hashCode } from '/@common/helpers';
import type { GmibWindowParams } from '/@common/WindowParams';
import type { LicenseRuntimeState } from '/@common/license';
import { setOutputHidden } from '/@renderer/store/currentSlice';

/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */

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
  document.addEventListener('DOMContentLoaded', () => {
    void onReady();
  });
} else {
  // DOM готов!
  void onReady();
}

ipcRenderer.on('outputVisibility', (_, hidden: boolean) => {
  ipcDispatch(setOutputHidden(hidden));
});

ipcRenderer
  .invoke('getOutputVisibility')
  .then(hidden => {
    ipcDispatch(setOutputHidden(Boolean(hidden)));
  })
  .catch(() => undefined);

// These same objects define both the exposed API and its renderer types.
const gmibApi = {
  versions: process.versions,
  server: { port: +(process.env['NIBUS_PORT'] ?? 9001) + 1 },
  setDispatch,
  nibus,
  config,
  dialogs,
  log: log.log.bind(log),
  setLogLevel: (logLevel: LogLevel): void => {
    setLogLevel(logLevel);
    nibus.setLogLevel(logLevel);
  },
  identify,
  initializeNovastar: (): Promise<boolean> =>
    gmibParams.then(params => Boolean(Reflect.get(params, import.meta.env.VITE_ANNOUNCE_NOVASTAR))),
  getLicenseState: (): Promise<LicenseRuntimeState | undefined> =>
    gmibParams.then(params => params.licenseState),
  getDeviceName: (): Promise<string | undefined> => gmibParams.then(params => params.info?.name),
  onLicenseStateChange: (listener: (state: LicenseRuntimeState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: LicenseRuntimeState) => listener(state);
    ipcRenderer.on('runtimeLicenseState', handler);
    return () => ipcRenderer.removeListener('runtimeLicenseState', handler);
  },
  mediaSource,
  plugins,
} as const;

export type GmibApi = typeof gmibApi;

exposeApi(gmibApi);
