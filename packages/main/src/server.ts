import { createServer } from 'node:http';
import type { Socket } from 'node:net';

import debugFactory from 'debug';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { port } from './config';

interface WebSocketEx extends WebSocket {
  _socket?: Socket;
  sourceId?: number;
}

export const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ server });

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:server`);

type BroadcastOptions = {
  event: string;
  data?: unknown[];
  remote?: string;
  sourceId?: number;
  all?: boolean;
};

const local = ['::1', '127.0.0.1', 'localhost'];

const ipEqual = (ip1 = '::1', ip2 = '::1'): boolean => {
  if (ip1 !== ip2 && local.includes(ip1) && local.includes(ip2)) return true;
  return ip1 === ip2;
};

const rawDataToString = (data: WebSocket.RawData): string =>
  Array.isArray(data)
    ? Buffer.concat(data).toString()
    : data instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(data)).toString()
      : data.toString();

wss.on('connection', (ws: WebSocketEx) => {
  ws.once('message', raw => {
    try {
      const parsed: unknown = JSON.parse(rawDataToString(raw));
      if (typeof parsed === 'object' && parsed !== null && 'sourceId' in parsed) {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.sourceId === 'number') {
          // eslint-disable-next-line no-param-reassign
          ws.sourceId = obj.sourceId;
        }
      }
    } catch (error) {
      debug(`error while parse ws-message: ${(error as Error).message}`);
    }
  });
});

export const broadcast = ({
  event,
  data = [0],
  remote,
  sourceId,
  all = false,
}: BroadcastOptions) => {
  wss.clients.forEach((ws: WebSocketEx) => {
    const remoteAddress = ws._socket?.remoteAddress;
    if (
      ws.readyState === WebSocket.OPEN &&
      (all || !ipEqual(remoteAddress, remote) || (sourceId != null && sourceId !== ws.sourceId))
    ) {
      ws.send(JSON.stringify({ event, data }));
    }
  });
};

server.listen(port, () => {
  // debug(`Playback server running on port ${port}...`);
});

// server.on('upgrade', (req, socket, head) => {
//   if (!isAuthorized(req)) {
//     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
//     socket.destroy();
//     return;
//   }
//   wss.handleUpgrade(req, socket, head, ws => {
//     wss.emit('connection', ws, req);
//   });
// });

export default server;
