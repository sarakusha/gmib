import type { RequestHandler } from 'express';

const unlicensedMutationPaths = new Set([
  '/activate',
  '/announce',
  '/checkForUpdates',
  '/handshake',
  '/identifier',
  '/login',
  '/license/retry',
  '/manage/v1/auth/password',
  '/update',
]);

export const isUnlicensedMutationPath = (path: string): boolean =>
  [...unlicensedMutationPaths].some(allowed => path === allowed || path.startsWith(`${allowed}/`));

export const createLicenseMutationGate =
  (getStatus: () => string): RequestHandler =>
  (req, res, next) => {
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      getStatus() === 'active' ||
      isUnlicensedMutationPath(req.path)
    ) {
      next();
      return;
    }
    res.status(403).send('Требуется действующая лицензия');
  };
