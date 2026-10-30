import { createServer, type Server } from 'node:http';

import express, { type RequestHandler } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  identifier: 'server-identifier',
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
}));

vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => mocks.identifier) },
}));
vi.mock('../src/secret', () => ({
  default: mocks.localSecret,
  getIncomingSecretWithRevision: vi.fn(() =>
    Promise.resolve({
      revision: 0,
      secret: mocks.remoteSecret,
    }),
  ),
}));
vi.mock('../src/pluginHost', () => ({
  authenticatedPluginApiHandler: vi.fn(),
  remotePluginApiHandler: vi.fn(),
  remotePluginStaticHandler: vi.fn(),
  remotePluginEventsHandler: vi.fn(),
}));

import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import {
  mountAuthenticatedPluginApi,
  mountRemotePluginControlGateway,
} from '../src/pluginApiMount';

const servers: Server[] = [];
const authorization = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };

const startApi = async (
  unsafeMode: boolean,
  status: 'active' | 'unlicensed',
  handler: RequestHandler,
  gatewayHandlers?: Parameters<typeof mountRemotePluginControlGateway>[1],
) => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    Object.assign(res.locals, { receivedAt: Date.now() });
    next();
  });
  const api = express.Router();
  if (gatewayHandlers) mountRemotePluginControlGateway(api, gatewayHandlers);
  mountApiAuth(api, {
    auth,
    getLicenseStatus: () => status,
    srpRouter: express.Router(),
    unsafeMode,
  });
  mountAuthenticatedPluginApi(api, { handler });
  app.use('/api', api);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not start');
  return `http://127.0.0.1:${address.port}/api/plugins/sample/settings`;
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        server =>
          new Promise<void>((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('authenticated plugin API mount', () => {
  it.each([false, true])('requires auth when unsafeMode=%s', async unsafeMode => {
    const handler = vi.fn<RequestHandler>((req, res) => {
      res.json({ pluginId: req.params['pluginId'] });
    });
    const url = await startApi(unsafeMode, 'active', handler);

    expect((await fetch(url)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();

    const authorized = await fetch(url, { headers: authorization });
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({ pluginId: 'sample' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps the common license mutation gate ahead of plugin PATCH handlers', async () => {
    const handler = vi.fn<RequestHandler>((_req, res) => res.json({ changed: true }));
    const unlicensedUrl = await startApi(true, 'unlicensed', handler);
    const blocked = await fetch(unlicensedUrl, {
      method: 'PATCH',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ brightness: 0.5 }),
    });
    expect(blocked.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();

    const activeUrl = await startApi(true, 'active', handler);
    const allowed = await fetch(activeUrl, {
      method: 'PATCH',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ brightness: 0.5 }),
    });
    expect(allowed.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('remote plugin control gateway mount', () => {
  const resources = [
    ['api/settings', '/settings'],
    ['static/control.html', '/control.html'],
    ['events', '/events'],
  ] as const;

  describe.each([false, true])('unsafeMode=%s', unsafeMode => {
    it.each(resources)('always requires authentication for %s', async (resource, forwardedPath) => {
      const apiHandler = vi.fn<RequestHandler>((req, res) => {
        res.json({ pluginId: req.params['pluginId'], path: req.path });
      });
      const staticHandler = vi.fn<RequestHandler>((req, res) => {
        res.json({ pluginId: req.params['pluginId'], path: req.path });
      });
      const eventsHandler = vi.fn<RequestHandler>((req, res) => {
        res.json({ pluginId: req.params['pluginId'], path: req.path });
      });
      const fallback = vi.fn<RequestHandler>((_req, res) => res.sendStatus(500));
      const ordinary = await startApi(unsafeMode, 'active', fallback, {
        apiHandler,
        staticHandler,
        eventsHandler,
      });
      const url = ordinary.replace(
        '/plugins/sample/settings',
        `/manage/v1/plugins/sample/control/${resource}`,
      );
      const unauthenticated = await fetch(url);
      expect(unauthenticated.status).toBe(401);
      expect(apiHandler).not.toHaveBeenCalled();
      expect(staticHandler).not.toHaveBeenCalled();
      expect(eventsHandler).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();

      const authorized = await fetch(url, { headers: authorization });
      expect(authorized.status).toBe(200);
      await expect(authorized.json()).resolves.toEqual({ pluginId: 'sample', path: forwardedPath });
      const selected = resource.startsWith('api/')
        ? apiHandler
        : resource.startsWith('static/')
          ? staticHandler
          : eventsHandler;
      expect(selected).toHaveBeenCalledOnce();
      expect(
        apiHandler.mock.calls.length +
          staticHandler.mock.calls.length +
          eventsHandler.mock.calls.length,
      ).toBe(1);
      expect(fallback).not.toHaveBeenCalled();
    });
  });
});
