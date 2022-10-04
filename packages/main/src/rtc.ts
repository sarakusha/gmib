import type { RtcMessage, WithWebSocketKey } from '/@common/rtc';
import { app, ipcMain } from 'electron';
import type { WebSocket } from 'ws';

import { wss } from './express';
import { playerWindows } from './windows';
import { openPlayer } from './playerWindow';

const sockets = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  const id = req.headers['sec-websocket-key'];
  if (!id) throw new Error('Invalid sec-websocket-key');
  sockets.set(id, ws);
  ws.on('message', async (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString()) as RtcMessage;
      if (['candidate', 'offer'].includes(msg.event)) {
        const win = playerWindows.get(msg.sourceId) ?? await openPlayer(msg.sourceId);
        if (win) {
          win.webContents.send('socket', { ...msg, id });
        }
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
    if (!ws || ws.readyState !== ws.OPEN) console.warn('Unknown or closed socket');
    else {
      ws.send(JSON.stringify(msg));
    }
  });
});
