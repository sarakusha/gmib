import { createServer, type Server } from 'node:http';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '/@common/config';
import { configSchema } from '/@common/schema';

const mocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  config: { store: {} as Config },
  identifier: 'server-identifier',
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
  updateConfigStore: vi.fn(),
}));

vi.mock('../src/config', () => ({ default: mocks.config }));
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
vi.mock('../src/nibus', () => ({
  updateConfigStore: mocks.updateConfigStore,
}));
import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import { mountManagementSettingsApi } from '../src/managementApi';

const baseConfig = (): Config =>
  ({
    brightness: 30,
    autobrightness: false,
    hid: { VID: 123, PID: 456 },
    logLevel: 'none',
    overheatProtection: {
      aggregation: 0,
      bottomBound: 65,
      enabled: false,
      interval: 15,
      step: 5,
      upperBound: 85,
    },
  }) as Config;

const servers: Server[] = [];
const authorization = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };

const startApi = async (unsafeMode: boolean, status: 'active' | 'unlicensed' = 'active') => {
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
  mountManagementSettingsApi(api);
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
  return `http://127.0.0.1:${address.port}/api`;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.store = baseConfig();
  mocks.updateConfigStore.mockImplementation((update: (current: Config) => Config) => {
    mocks.config.store = update(mocks.config.store);
    mocks.broadcast('config', mocks.config.store);
    return mocks.config.store;
  });
});

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

describe('management API runtime mount', () => {
  it.each([false, true])(
    'keeps settings strict when unsafeMode=%s',
    async unsafeMode => {
      const baseUrl = await startApi(unsafeMode);

      expect((await fetch(`${baseUrl}/manage/v1/settings`)).status).toBe(401);
    },
  );

  it('allows authenticated reads but rejects unlicensed settings mutations', async () => {
    const baseUrl = await startApi(true, 'unlicensed');
    const get = await fetch(`${baseUrl}/manage/v1/settings`, { headers: authorization });
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toEqual({
      autobrightness: false,
      brightness: 30,
      spline: configSchema.spline.default,
      sunSpline: configSchema.sunSpline.default,
    });

    const patch = await fetch(`${baseUrl}/manage/v1/settings`, {
      method: 'PATCH',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ brightness: 60 }),
    });
    expect(patch.status).toBe(403);
    expect(mocks.updateConfigStore).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('writes and broadcasts once, then keeps no-op and dry-run free of side effects', async () => {
    const baseUrl = await startApi(true);
    const request = (body: unknown, query = '') =>
      fetch(`${baseUrl}/manage/v1/settings${query}`, {
        method: 'PATCH',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const first = await request({ autobrightness: true, brightness: 70 });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      changed: true,
      dryRun: false,
      settings: { autobrightness: true, brightness: 70 },
    });
    expect(mocks.updateConfigStore).toHaveBeenCalledOnce();
    expect(mocks.broadcast).toHaveBeenCalledOnce();
    expect(mocks.config.store.hid).toEqual({ VID: 123, PID: 456 });

    const noOp = await request({ autobrightness: true, brightness: 70 });
    await expect(noOp.json()).resolves.toMatchObject({ changed: false, dryRun: false });
    const check = await request({ brightness: 80 }, '?dryRun=true');
    await expect(check.json()).resolves.toMatchObject({
      changed: true,
      dryRun: true,
      settings: { brightness: 80 },
    });
    expect(mocks.updateConfigStore).toHaveBeenCalledOnce();
    expect(mocks.broadcast).toHaveBeenCalledOnce();
    expect(mocks.config.store.brightness).toBe(70);
  });
});
