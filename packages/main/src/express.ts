import path from 'path';

// import debugFactory from 'debug';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from 'body-parser';

import api, { mediaRoot } from './api';
import { dbReady } from './db';
import { app } from './server';

import preventLoadSourceMap from '/@common/preventLoadSourceMap';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:express`);

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
    hsts: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors({ origin: '*', exposedHeaders: ['x-ni-identifier', 'x-from'] }));
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

const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
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
  api,
);
app.use(errorHandler);
