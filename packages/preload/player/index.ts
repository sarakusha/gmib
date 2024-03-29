import { contextBridge, ipcRenderer } from 'electron';

import expandTypes from '/@common/expandTypes';

// import debugFactory from 'debug';

import * as identify from '../common/identify';
import log from '../common/initlog';
// import expandTypes from '/@common/expandTypes';
import ipcDispatch, { setDispatch } from '../common/ipcDispatch';
// import '@sentry/electron/preload';

import { updateSrcObject } from './mediaStream';
// import * as nodeCrypto from './nodeCrypto';

import './videoOuts';
import { setFocused } from '/@player/store/currentSlice';

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:player-preload-${sourceId}`);

// ipcRenderer.send('register-source-channel', sourceId);

// contextBridge.exposeInMainWorld('nodeCrypto', expandTypes(nodeCrypto));
contextBridge.exposeInMainWorld('mediaStream', { updateSrcObject });
contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('identify', expandTypes(identify));
contextBridge.exposeInMainWorld('socket', {
  broadcast: (event: string, ...args: unknown[]) =>
    ipcRenderer.send('broadcast', event, [sourceId, ...args]),
});
contextBridge.exposeInMainWorld('onUpdatePlaylist', (callback: () => void) =>
  ipcRenderer.on('updatePlaylist', callback),
);

ipcRenderer.on('focus', (_, focused: boolean) => {
  ipcDispatch(setFocused(focused));
});
