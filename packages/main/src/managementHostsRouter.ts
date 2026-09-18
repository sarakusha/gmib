import express, { type Request, type RequestHandler, type Response } from 'express';

import type { ManagementHostsService } from './managementHosts';
import {
  ManagementHostsRevisionError,
  ManagementHostsStoredDataError,
  ManagementHostsValidationError,
} from './managementHosts';

export type ManagementHostsRouterOptions = {
  service: ManagementHostsService;
  /** Authentication must be supplied by the application; unsafeMode does not bypass it. */
  strictAuth: RequestHandler;
};

const parseDryRun = (req: Request): boolean => {
  const unknown = Object.keys(req.query).find(key => key !== 'dryRun');
  if (unknown) {
    throw new ManagementHostsValidationError(
      `query.${unknown} is not supported`,
      `query.${unknown}`,
    );
  }
  const value = req.query['dryRun'];
  if (value === undefined) return false;
  if (typeof value !== 'string' || !['true', 'false'].includes(value)) {
    throw new ManagementHostsValidationError('dryRun must be true or false', 'query.dryRun');
  }
  return value === 'true';
};

const sendError = (res: Response, error: unknown): boolean => {
  if (error instanceof ManagementHostsValidationError) {
    res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
      },
    });
    return true;
  }
  if (error instanceof ManagementHostsRevisionError) {
    res.status(412).json({
      error: {
        code: error.code,
        message: error.message,
        currentRevision: error.currentRevision,
      },
    });
    return true;
  }
  if (error instanceof ManagementHostsStoredDataError) {
    res.status(500).json({
      error: { code: error.code, message: error.message, field: error.field },
    });
    return true;
  }
  return false;
};

export const createManagementHostsRouter = ({
  service,
  strictAuth,
}: ManagementHostsRouterOptions): express.Router => {
  if (typeof strictAuth !== 'function') {
    throw new TypeError('management hosts router requires strictAuth');
  }
  const router = express.Router();
  router.use(strictAuth);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/hosts', async (_req, res, next) => {
    try {
      const result = await service.get();
      res.json(result);
    } catch (error) {
      if (!sendError(res, error)) next(error);
    }
  });
  router.put('/hosts', (req, res, next) => {
    try {
      const result = service.put(req.body, parseDryRun(req));
      res.json(result);
    } catch (error) {
      if (!sendError(res, error)) next(error);
    }
  });
  return router;
};
