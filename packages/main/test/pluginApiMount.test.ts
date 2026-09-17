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
  getIncomingSecretWithRevision: vi.fn(async () => ({
    revision: 0,
    secret: mocks.remoteSecret,
  })),
}));
vi.mock('../src/pluginHost', () => ({ authenticatedPluginApiHandler: vi.fn() }));

import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import { mountAuthenticatedPluginApi } from '../src/pluginApiMount';

const servers: Server[] = [];
const authorization = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };

const startApi = async (
  unsafeMode: boolean,
  status: 'active' | 'unlicensed',
  handler: RequestHandler,
) => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    Object.assign(res.locals, { receivedAt: Date.now() });
    next();
  });
  const api = express.Router();
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
