import path from 'path';

import bodyParser from 'body-parser';
import debugFactory from 'debug';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import type { ErrorRequestHandler } from 'express-serve-static-core';
import helmet from 'helmet';
import cors from 'cors';

import api, { mediaRoot } from './api';
import { port } from './config';
import { dbReady } from './db';

import preventLoadSourceMap from '/@common/preventLoadSourceMap';
import auth from './auth';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:express`);

const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ clientTracking: false, noServer: true });

// const isAuthorized = (req: IncomingMessage) =>
//   import.meta.env.DEV ||
//   (req.url && url.parse(req.url, true).query.access_token === secret) ||
//   req.headers.authorization === `Bearer ${secret}`;

// const isAuthorizedHandler: RequestHandler = (req, res, next) => {
//   if (isAuthorized(req)) {
//     next();
//   } else {
//     res.sendStatus(401);
//   }
// };

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(cors({ origin: '*' }));
import.meta.env.PROD && app.use(preventLoadSourceMap);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

if (!import.meta.env.DEV) {
  const root = path.join(__dirname, '../../renderer/dist');
  app.get('/index.html' /* , isAuthorizedHandler */);
  app.get('/player.html' /* , isAuthorizedHandler */);
  app.use(express.static(root));
}

const outputRoot = path.resolve(__dirname, '../assets/output');

app.use(
  '/output',
  // (req, res, next) => {
  //   debug(
  //     `${req.method} ${req.url} ${outputRoot} ${fs.existsSync(
  //       path.join(outputRoot, 'index.html'),
  //     )}`,
  //   );
  //   next();
  // },
  express.static(outputRoot),
);

// app.use('/player', express.static(path.resolve(__dirname, '../../player/dist')));

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if ('errno' in error && 'code' in error && error.code === 'SQLITE_CONSTRAINT') {
    const { message, code, errno } = error;
    res.status(409).json({ message, code, errno });
  } else {
    next(error); // forward to next middleware
  }
};

app.use('/public', express.static(mediaRoot));
app.use(
  '/api',
  (_, __, next) => {
    dbReady.then(next);
  },
  auth.unless({ path: [/\/api\/login\/.*/, /\/api\/handshake\/.*/, '/api/identifier'] }),
  api,
);
app.use(errorHandler);

server.listen(port, () => {
  debug(`Playback server running on port ${port}...`);
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
