import { createServer } from 'node:http';
import type { Socket } from 'node:net';

import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { port } from './config';

interface WebSocketEx extends WebSocket {
  _socket?: Socket;
}

export const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ server });

type BroadcastOptions = {
  event: string;
  data?: unknown[];
  remote?: string;
};

const local = ['::1', '127.0.0.1', 'localhost'];

const ipEqual = (ip1 = '::1', ip2 = '::1'): boolean => {
  if (ip1 !== ip2 && local.includes(ip1) && local.includes(ip2)) return true;
  return ip1 === ip2;
};

export const broadcast = ({ event, data = [0], remote }: BroadcastOptions) => {
  wss.clients.forEach((ws: WebSocketEx) => {
    // eslint-disable-next-line no-underscore-dangle
    const remoteAddress = ws._socket?.remoteAddress;
    if (ws.readyState === WebSocket.OPEN && !ipEqual(remoteAddress, remote)) {
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
