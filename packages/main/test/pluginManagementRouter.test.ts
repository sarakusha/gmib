import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import generateSignature from '/@common/generateSignature';

const mocks = vi.hoisted(() => ({
  identifier: 'server-identifier',
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
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
vi.mock('../src/licenseState', () => ({ requireLicenseCapability: vi.fn() }));
vi.mock('../src/pluginLifecycle', () => ({
  PluginLifecycleError: class PluginLifecycleError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly status = 400,
    ) {
      super(message);
    }
  },
  pluginLifecycle: {},
}));

import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import { createPluginManagementRouter } from '../src/pluginManagementRouter';

const listen = async (app: express.Express) => {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      ),
  };
};

const service = () => ({
  list: vi.fn(async () => []),
  catalog: vi.fn(async () => []),
  inspectArchive: vi.fn(),
  inspectOfficial: vi.fn(),
  installArchive: vi.fn(),
  installOfficial: vi.fn(),
  setEnabled: vi.fn(),
  uninstall: vi.fn(),
});

const createApp = (lifecycle: ReturnType<typeof service>, requireCapability: () => void) => {
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    Object.assign(res.locals, { receivedAt: Date.now() });
    next();
  });
  const api = express.Router();
  api.use(
    '/manage/v1/plugins',
    auth,
    createPluginManagementRouter(lifecycle as never, {
      requireCapability,
    }),
  );
  mountApiAuth(api, {
    auth,
    getLicenseStatus: () => 'unlicensed',
    srpRouter: express.Router(),
    unsafeMode: true,
  });
  api.get('/plugins/:pluginId', (req, res) => res.json({ pluginId: req.params.pluginId }));
  app.use('/api', api);
  return app;
};

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close => close()));
});

describe('plugin management routes', () => {
  it('requires auth before capability even under unsafe mode and leaves runtime routes intact', async () => {
    let capabilityAllowed = false;
    const requireCapability = vi.fn(() => {
      if (!capabilityAllowed) throw Object.assign(new Error('Plus required'), { status: 403 });
    });
    const server = await listen(createApp(service(), requireCapability));
    servers.push(server.close);

    const unauthorized = await fetch(`${server.baseUrl}/api/manage/v1/plugins`);
    expect(unauthorized.status).toBe(401);
    expect(requireCapability).not.toHaveBeenCalled();

    const headers = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };
    const unlicensed = await fetch(`${server.baseUrl}/api/manage/v1/plugins`, { headers });
    expect(unlicensed.status).toBe(403);

    capabilityAllowed = true;
    const authorized = await fetch(`${server.baseUrl}/api/manage/v1/plugins`, { headers });
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({ plugins: [] });

    const runtime = await fetch(`${server.baseUrl}/api/plugins/sample`);
    expect(runtime.status).toBe(200);
    await expect(runtime.json()).resolves.toEqual({ pluginId: 'sample' });
  });

  it('rejects tampered archive bytes although the expected hash query has a valid HMAC', async () => {
    const lifecycle = service();
    const server = await listen(createApp(lifecycle, () => undefined));
    servers.push(server.close);
    const expectedArchive = Buffer.from('expected archive');
    const tamperedArchive = Buffer.from('tampered archive');
    const expectedSha256 = createHash('sha256').update(expectedArchive).digest('hex');
    const requestPath = `/api/manage/v1/plugins/archive/inspect?sha256=${expectedSha256}`;
    const timestamp = Date.now();
    const response = await fetch(`${server.baseUrl}${requestPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-ni-identifier': 'remote-client',
        'x-ni-timestamp': String(timestamp),
        'x-ni-signature': generateSignature(mocks.remoteSecret, 'POST', requestPath, timestamp),
      },
      body: tamperedArchive,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'archive_hash_mismatch' },
    });
    expect(lifecycle.inspectArchive).not.toHaveBeenCalled();
  });
});
