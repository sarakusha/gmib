import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

import type { AuthorizationContext } from './auth';
import { SrpAuthError, type SrpAuthService } from './srpAuthService';

const sendError = (res: Response, error: unknown): void => {
  const known = error instanceof SrpAuthError ? error : undefined;
  res.status(known?.status ?? 500).json({
    error: {
      code: known?.code ?? 'internal_error',
      message: known?.message ?? 'Внутренняя ошибка сервера',
      ...(known?.reauthenticateRequired ? { reauthenticateRequired: true } : {}),
    },
  });
};

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next: NextFunction) => {
    void handler(req, res).catch(error => {
      if (res.headersSent) next(error);
      else sendError(res, error);
    });
  };

export const createSrpAuthRouter = (
  service: SrpAuthService,
  strictAuth: RequestHandler,
): express.Router => {
  const router = express.Router();
  router.get(
    '/handshake/:id',
    asyncRoute(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await service.createHandshake(id));
    }),
  );
  router.post(
    '/login/:id',
    asyncRoute(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await service.completeLogin(id, req.body));
    }),
  );
  router.put(
    '/manage/v1/auth/password',
    strictAuth,
    asyncRoute(async (req, res) => {
      const authorization = (res.locals as { authorization?: AuthorizationContext }).authorization;
      res.json(
        await service.rotateCredentials(
          req.body,
          authorization?.kind === 'remote' ? authorization.revision : undefined,
        ),
      );
    }),
  );
  return router;
};
