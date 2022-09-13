import path from 'path';

import bodyParser from 'body-parser';
import debugFactory from 'debug';
import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express-serve-static-core';
import helmet from 'helmet';

import api, { mediaRoot } from './api';
import { port } from './config';
import { dbReady } from './db';
import secret from './secret';

import preventLoadSourceMap from '/@common/preventLoadSourceMap';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:express`);

const app = express();

const isAuthorized: RequestHandler = (req, res, next) => {
  if (req.query.access_token === secret || req.header('Authorization') === `Bearer ${secret}`) {
    next();
  } else {
    res.sendStatus(401);
  }
};

app.use(helmet());
// app.use(helmet.originAgentCluster());
// app.use(helmet.crossOriginEmbedderPolicy());
// app.use(helmet.crossOriginOpenerPolicy());
app.use(preventLoadSourceMap);
// app.use((req, res, next) => {
//   if (req.method === 'GET' && req.url.endsWith('.js.map')) {
//     // fake js.map to prevent warnings
//     res.json({ vesrion: 3, file: '', sourceRoot: '', sources: [], names: [], mappings: '' });
//   } else {
//     next();
//   }
// });
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

if (!import.meta.env.DEV) {
  const root = path.join(__dirname, '../../renderer/dist');
  app.get('/index.html', isAuthorized);
  app.get('/player.html', isAuthorized);
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
  isAuthorized,
  (_, __, next) => {
    dbReady.then(next);
  },
  api,
);
app.use(errorHandler);

const server = app.listen(port, () => {
  debug(`Playback server running on port ${port}...`);
});

export default server;
