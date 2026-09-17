import express, { type Request, type RequestHandler, type Response } from 'express';

import type { ManagementSettingsService } from './managementSettings';
import { ManagementSettingsValidationError } from './managementSettings';

export type ManagementSettingsRouterOptions = {
  service: ManagementSettingsService;
  /** Authentication must be supplied by the application; unsafeMode does not bypass it. */
  strictAuth: RequestHandler;
};

const sendValidationError = (res: Response, error: ManagementSettingsValidationError): void => {
  res.status(400).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    },
  });
};

const parseDryRun = (req: Request, allowDryRun = true): boolean => {
  const keys = Object.keys(req.query);
  if (!allowDryRun && keys.length > 0) {
    const field = `query.${keys[0]}`;
    throw new ManagementSettingsValidationError(`${field} is not supported`, field);
  }
  const unknown = keys.find(key => key !== 'dryRun');
  if (unknown) {
    throw new ManagementSettingsValidationError(
      `query.${unknown} is not supported`,
      `query.${unknown}`,
    );
  }
  const value = req.query['dryRun'];
  if (value === undefined) return false;
  if (typeof value !== 'string' || !['true', 'false'].includes(value)) {
    throw new ManagementSettingsValidationError('dryRun must be true or false', 'query.dryRun');
  }
  return value === 'true';
};

export const createManagementSettingsRouter = ({
  service,
  strictAuth,
}: ManagementSettingsRouterOptions): express.Router => {
  if (typeof strictAuth !== 'function') {
    throw new TypeError('management settings router requires strictAuth');
  }
  const router = express.Router();
  router.use(strictAuth);
  router.get('/settings', (req, res) => {
    try {
      parseDryRun(req, false);
      res.json(service.get());
    } catch (error) {
      if (error instanceof ManagementSettingsValidationError) sendValidationError(res, error);
      else throw error;
    }
  });
  router.patch('/settings', async (req, res, next) => {
    try {
      const dryRun = parseDryRun(req);
      res.json(await service.patch(req.body, dryRun));
    } catch (error) {
      if (error instanceof ManagementSettingsValidationError) sendValidationError(res, error);
      else next(error);
    }
  });
  return router;
};
