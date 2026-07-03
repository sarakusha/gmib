import type { NextFunction, Request, Response } from 'express';
import { unless } from 'express-unless';
// import debugFactory from 'debug';

import generateSignature from '/@common/generateSignature';

import localConfig from './localConfig';
import secret, { getIncomingSecret } from './secret';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:auth`);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MAX_DIFFERENCE_IN_TIME = 5 * MINUTE;
const MAX_MEDIA_UPLOAD_DIFFERENCE_IN_TIME = 6 * HOUR;

const authorization = `Bearer ${secret.toString('base64')}`;

const getMaxDifferenceInTime = (req: Request): number =>
  req.method.toUpperCase() === 'POST' && req.originalUrl.split('?')[0] === '/api/media'
    ? MAX_MEDIA_UPLOAD_DIFFERENCE_IN_TIME
    : MAX_DIFFERENCE_IN_TIME;

export const isAuthorized = async (req: Request, receivedAt = Date.now()) => {
  if (req.headers.authorization === authorization) return true;
  const id = req.headers['x-ni-identifier'];
  const apiSecret = typeof id === 'string' ? await getIncomingSecret(id) : undefined;
  const timestamp = Number(req.headers['x-ni-timestamp']);
  const maxDifferenceInTime = getMaxDifferenceInTime(req);
  const expectedSignature =
    apiSecret && generateSignature(apiSecret, req.method, req.originalUrl, timestamp, req.body);
  // debug(`id: ${id}`);
  // debug(`method: ${req.method} ${req.originalUrl} ${timestamp}`);
  // debug(`body: ${typeof req.body === 'string' ? req.body : JSON.stringify(req.body)}`);
  return Boolean(
    expectedSignature &&
    expectedSignature === req.headers['x-ni-signature'] &&
    Math.abs(receivedAt - timestamp) < maxDifferenceInTime,
  );
};

const auth = async (req: Request, res: Response, next: NextFunction) => {
  const receivedAt = typeof res.locals.receivedAt === 'number' ? res.locals.receivedAt : undefined;
  if (await isAuthorized(req, receivedAt)) next();
  else res.status(401).send({ identifier: localConfig.get('identifier') });
};

auth.unless = unless;

export default auth;
