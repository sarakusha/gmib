/* eslint-disable no-param-reassign */
/* eslint-disable import/prefer-default-export */
import type { RtcMessage, WithWebSocketKey } from '/@common/rtc';

import { app, ipcMain } from 'electron';

import type { WebSocket } from 'ws';
import debugFactory from 'debug';
import memoize from 'lodash/memoize';

import { wss } from './server';
import { openPlayer } from './playerWindow';
import { findPlayerWindow } from './windowStore';
// import master from './MasterBrowser';
import { getMainWindow } from './mainWindow';

const sockets = new Map<string, WebSocket>();

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:rtc`);

type AliveWebSocket = WebSocket & {
  isAlive?: boolean;
};

function heartbeat(this: AliveWebSocket) {
  this.isAlive = true;
}

const interval = setInterval(() => {
  wss.clients.forEach((ws: AliveWebSocket) => {
    if (ws.isAlive === false) {
      ws.terminate();
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  });
}, 30000).unref();

wss.on('connection', (ws: AliveWebSocket, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

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
      // console.log({ message: msg });
      if (['candidate', 'answer', 'request'].includes(msg.event)) {
        const win =
          msg.sourceType === 'player'
            ? findPlayerWindow(msg.sourceId) ?? (await openPlayer(msg.sourceId, { hidden: true }))
            : getMainWindow();
        // console.log('FOUND', win);
        if (win) win.webContents.send('socket', { ...msg, id });
      }
    }
  });
  ws.on('close', () => {
    sockets.delete(id);
  });
});

// const events = [
//   'add',
//   'change',
//   'illuminance',
//   'remove',
//   'screen',
//   'update',
//   'cabinet',
//   'telemetry',
//   'broadcastDetected',
// ] as const;

// const makeHandler = memoize((event: string) => (...args: unknown[]) => {
//   const msg = JSON.stringify({ event, data: args });
//   wss.clients.forEach(ws => {
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(msg);
//     }
//   });
// });

// events.forEach(event => master.on(event, makeHandler(event)));
// const close = () => {
//   app.off('will-quit', close);
//   events.forEach(event => master.off(event, makeHandler.cache.get(event)));
// };

// master.on('close', close);
// app.once('will-quit', close);

wss.once('close', () => {
  clearInterval(interval);
  // close();
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
