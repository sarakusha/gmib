import type { NextFunction, Request, Response } from 'express';
import { unless } from 'express-unless';
// import debugFactory from 'debug';

import generateSignature from '/@common/generateSignature';

import localConfig from './localConfig';
import secret, { getIncomingSecretWithRevision } from './secret';

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

export type AuthorizationContext =
  { kind: 'local' } | { identifier: string; kind: 'remote'; revision: number };

export const authorizeRequest = async (
  req: Request,
  receivedAt = Date.now(),
): Promise<AuthorizationContext | undefined> => {
  if (req.headers.authorization === authorization) return { kind: 'local' };
  const id = req.headers['x-ni-identifier'];
  if (typeof id !== 'string') return undefined;
  const incoming = await getIncomingSecretWithRevision(id);
  const timestamp = Number(req.headers['x-ni-timestamp']);
  const maxDifferenceInTime = getMaxDifferenceInTime(req);
  const expectedSignature =
    incoming?.secret &&
    generateSignature(incoming.secret, req.method, req.originalUrl, timestamp, req.body);
  return expectedSignature &&
    expectedSignature === req.headers['x-ni-signature'] &&
    Math.abs(receivedAt - timestamp) < maxDifferenceInTime
    ? { kind: 'remote', identifier: id, revision: incoming.revision }
    : undefined;
};

export const isAuthorized = async (req: Request, receivedAt = Date.now()) =>
  Boolean(await authorizeRequest(req, receivedAt));

const auth = async (req: Request, res: Response, next: NextFunction) => {
  const receivedAt = typeof res.locals.receivedAt === 'number' ? res.locals.receivedAt : undefined;
  const authorizationContext = await authorizeRequest(req, receivedAt);
  if (authorizationContext) {
    Object.assign(res.locals, { authorization: authorizationContext });
    next();
  } else res.status(401).send({ identifier: localConfig.get('identifier') });
};

auth.unless = unless;

export default auth;
