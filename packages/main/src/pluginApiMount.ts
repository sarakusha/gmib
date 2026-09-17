import type { RequestHandler, Router } from 'express';

import auth from './auth';
import { authenticatedPluginApiHandler } from './pluginHost';

export const mountAuthenticatedPluginApi = (
  api: Router,
  options: {
    handler?: RequestHandler;
    strictAuth?: RequestHandler;
  } = {},
): void => {
  api.use(
    '/plugins/:pluginId',
    options.strictAuth ?? auth,
    options.handler ?? authenticatedPluginApiHandler,
  );
};
