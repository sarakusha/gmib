import type { RequestHandler } from 'express';

// License restrictions apply to extended features, never to the base runtime,
// device settings, diagnostics or the ability to recover a remote installation.
const licensedMutationPaths = new Set([
  '/plugins',
  '/novastar',
  '/media',
  '/playlist',
  '/player',
  '/mapping',
  '/pages',
  '/scheduler',
]);

export const isUnlicensedMutationPath = (path: string): boolean =>
  ![...licensedMutationPaths].some(prefix => path === prefix || path.startsWith(`${prefix}/`));

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
