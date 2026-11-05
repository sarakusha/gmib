import { ipcRenderer } from 'electron';

import exposeApi from '../common/exposeApi';

// import debugFactory from 'debug';

import * as identify from '../common/identify';
import log from '../common/initlog';
import ipcDispatch, { setDispatch } from '../common/ipcDispatch';
// import '@sentry/electron/preload';

import { seek, updateSrcObject } from './mediaStream';
// import * as nodeCrypto from './nodeCrypto';

import './videoOuts';
import type { PlayerOutputState } from '/@common/rtc';
import { setPlayerOutputState } from '/@player/store/currentSlice';

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:player-preload-${sourceId}`);

// ipcRenderer.send('register-source-channel', sourceId);

const playerApi = {
  mediaStream: { seek, updateSrcObject },
  media: {
    download: (filename: string): Promise<boolean> => ipcRenderer.invoke('downloadMedia', filename),
  },
  log: log.log.bind(log),
  setDispatch,
  identify,
  socket: {
    broadcast: (event: string, ...args: unknown[]) =>
      ipcRenderer.send('broadcast', event, [sourceId, ...args]),
  },
  onUpdatePlaylist: (callback: () => void) => ipcRenderer.on('updatePlaylist', callback),
} as const;

export type PlayerApi = typeof playerApi;

exposeApi(playerApi);

let receivedOutputState = false;
ipcRenderer.on('playerOutputState', (_, { hidden, visible }: PlayerOutputState) => {
  receivedOutputState = true;
  ipcDispatch(setPlayerOutputState({ hidden, visible }));
});

ipcRenderer
  .invoke('getPlayerOutputState')
  .then((state: PlayerOutputState | undefined) => {
    if (!receivedOutputState && state) ipcDispatch(setPlayerOutputState(state));
  })
  .catch(() => undefined);
