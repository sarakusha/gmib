/**
 * Не используется
 */
import { ipcRenderer } from 'electron';

import type { AnyAction } from '@reduxjs/toolkit';
import debugFactory from 'debug';

import ipcDispatch from '../common/ipcDispatch';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload:output`);

const ports = new Map<number, MessagePort>();

ipcRenderer.on('new-screen', (event, screenId: number) => {
  debug(`#${screenId} screen channel is created`);
  const [port] = event.ports;
  ports.set(screenId, port);
  port.onmessage = ({ data: action }: MessageEvent<AnyAction>) => {
    ipcDispatch(action);
  };
});

// eslint-disable-next-line import/prefer-default-export
export const dispatch = (screenId: number, action: AnyAction): void => {
  const port = ports.get(screenId);
  if (port) {
    port.postMessage(action);
  } else {
    debug(`unknown screen: #${screenId}`);
  }
};
