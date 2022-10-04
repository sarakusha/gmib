import type { NextFunction, Request, Response } from 'express';
import { unless } from 'express-unless';
// import debugFactory from 'debug';

import generateSignature from '/@common/generateSignature';
import secret, { getIncomingSecret } from './secret';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:auth`);
const MAX_DIFFERENCE_IN_TIME = 5 * 60 * 1000;

const authorization = `Bearer ${secret.toString('base64')}`;

export const isAuthorized = async (req: Request) => {
  if (req.headers.authorization === authorization) return true;
  const id = req.headers['x-ni-identifier'];
  const apiSecret = typeof id === 'string' ? await getIncomingSecret(id) : undefined;
  const timestamp = Number(req.headers['x-ni-timestamp']);
  const expectedSignature =
    apiSecret && generateSignature(apiSecret, req.method, req.originalUrl, timestamp, req.body);
  return Boolean(
    expectedSignature &&
      expectedSignature === req.headers['x-ni-signature'] &&
      Math.abs(Date.now() - timestamp) < MAX_DIFFERENCE_IN_TIME,
  );
};

const auth = async (req: Request, res: Response, next: NextFunction) => {
  if (await isAuthorized(req)) next();
  else res.sendStatus(401);
};

auth.unless = unless;

export default auth;
