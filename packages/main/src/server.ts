import { createServer } from 'http';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { port } from './config';

export const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ server });
export const broadcast = (msg: string) => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
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
