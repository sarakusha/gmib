import express, { type RequestHandler, type Router } from 'express';

import auth from './auth';
import {
  authenticatedPluginApiHandler,
  remotePluginApiHandler,
  remotePluginEventsHandler,
  remotePluginStaticHandler,
} from './pluginHost';

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

// Mount before mountApiAuth: remote controls require strict authentication even
// when ordinary API authentication is disabled by unsafeMode.
export const mountRemotePluginControlGateway = (
  api: Router,
  options: {
    apiHandler?: RequestHandler;
    staticHandler?: RequestHandler;
    eventsHandler?: RequestHandler;
  } = {},
): void => {
  const gateway = express.Router({ mergeParams: true });
  gateway.use('/api', options.apiHandler ?? remotePluginApiHandler);
  gateway.use('/static', options.staticHandler ?? remotePluginStaticHandler);
  gateway.get('/events', options.eventsHandler ?? remotePluginEventsHandler);
  api.use('/manage/v1/plugins/:pluginId/control', auth, gateway);
};
