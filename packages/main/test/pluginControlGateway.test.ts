import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ root: '/tmp/gmib-plugin-gateway-not-initialized' }));
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => mocks.root), on: vi.fn(), quit: vi.fn() },
  powerMonitor: { on: vi.fn(), off: vi.fn() },
  shell: { openExternal: vi.fn() },
}));
vi.mock('../src/licenseState', () => ({
  hasLicenseCapability: vi.fn(() => true),
  requireLicenseCapability: vi.fn(),
}));
vi.mock('../src/config', () => ({ port: 9002, testsDeferred: { promise: Promise.resolve() } }));
vi.mock('../src/db', () => ({ dbReady: Promise.resolve() }));
vi.mock('../src/page', () => ({
  deletePage: vi.fn(),
  getPages: vi.fn(() => Promise.resolve([])),
  uniquePageTitle: vi.fn((value: unknown) => Promise.resolve(value)),
  upsertPermanentPage: vi.fn(),
}));
vi.mock('../src/screen', () => ({ getScreens: vi.fn(() => Promise.resolve([])) }));
vi.mock('../src/screenOutput', () => ({ updateTest: vi.fn() }));
vi.mock('../src/server', () => ({ broadcast: vi.fn() }));
vi.mock('../src/pluginOutput', () => ({ createPluginOutput: vi.fn(() => ({})) }));
vi.mock('../src/pluginNibus', () => ({ createPluginNibus: vi.fn(() => ({})) }));
vi.mock('../src/pluginDatabase', () => ({ openPluginDatabase: vi.fn() }));

import {
  listPlugins,
  localPluginApiHandler,
  pluginStaticHandler,
  remotePluginApiHandler,
  remotePluginEventsHandler,
  remotePluginStaticHandler,
  startPlugins,
} from '../src/pluginHost';

let server: Server | undefined;
let baseUrl: string;

const fixture = async (id: string, localOnly: boolean) => {
  const directory = path.join(mocks.root, 'plugins', id);
  await fs.promises.mkdir(path.join(directory, 'public'), { recursive: true });
  await fs.promises.writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify({
      id,
      name: id,
      version: '1.0.0',
      gmibApi: '^1.0.0',
      main: 'main.cjs',
      public: 'public',
      permissions: ['http.routes', 'realtime'],
      localOnly,
      control: { path: 'control.html' },
    }),
  );
  await fs.promises.writeFile(path.join(directory, 'public', 'control.html'), `<h1>${id}</h1>`);
  await fs.promises.writeFile(
    path.join(directory, 'main.cjs'),
    `
    exports.activate = context => {
      context.http.get('/local', request => ({ route: 'local', path: request.path, query: request.query }));
      context.http.put('/local', request => ({ route: 'local', receivedBody: request.body, receivedMethod: request.method }));
      ${localOnly ? '' : "context.http.get('/authenticated', () => ({ route: 'authenticated' }), { access: 'authenticated' });"}
      context.http.post('/emit', () => {
        context.events.publish('changed', { value: 7 });
        return { published: true };
      });
    };
  `,
  );
};

beforeAll(async () => {
  mocks.root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gmib-plugin-gateway-'));
  await fixture('shared-control', false);
  await fixture('local-control', true);
  await startPlugins();
  expect(await listPlugins()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        loaded: true,
        manifest: expect.objectContaining({ id: 'shared-control' }),
      }),
      expect.objectContaining({
        loaded: true,
        manifest: expect.objectContaining({ id: 'local-control' }),
      }),
    ]),
  );

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // Exercise the ordinary LAN boundary without relying on an external interface.
    Object.defineProperty(req.socket, 'remoteAddress', {
      configurable: true,
      value: req.headers['x-test-lan'] ? '192.0.2.40' : '127.0.0.1',
    });
    next();
  });
  // Strict authentication is verified by the API mount tests; this harness covers
  // the host-side policy after authentication, including proxy loopback requests.
  app.use('/gateway/:pluginId/api', remotePluginApiHandler);
  app.use('/gateway/:pluginId/events', remotePluginEventsHandler);
  app.use('/gateway/:pluginId/static', remotePluginStaticHandler);
  app.use('/plugins/:pluginId/api', localPluginApiHandler);
  app.use('/plugins/:pluginId', pluginStaticHandler);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', () => {
      server!.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Test server did not start');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server!.close(error => (error ? reject(error) : resolve())),
    );
  }
  await fs.promises.rm(mocks.root, { recursive: true, force: true });
});

describe('remote plugin control gateway', () => {
  it.each(['api/local', 'static/control.html', 'events'])(
    'rejects localOnly %s even when the proxy connects over loopback',
    async resource => {
      const response = await fetch(`${baseUrl}/gateway/local-control/${resource}`);
      expect(response.status).toBe(403);
    },
  );

  it.each(['local', 'authenticated'])('forwards a non-local-only %s route', async route => {
    const response = await fetch(`${baseUrl}/gateway/shared-control/api/${route}?screen=2`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ route });
  });

  it('preserves the plugin route path, query, method and body', async () => {
    const get = await fetch(`${baseUrl}/gateway/shared-control/api/local?screen=2&screen=3`);
    expect(await get.json()).toEqual({
      route: 'local',
      path: '/local',
      query: { screen: ['2', '3'] },
    });
    const put = await fetch(`${baseUrl}/gateway/shared-control/api/local`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({
      route: 'local',
      receivedBody: { enabled: true },
      receivedMethod: 'PUT',
    });
  });

  it('serves non-local-only control assets through the gateway', async () => {
    const response = await fetch(`${baseUrl}/gateway/shared-control/static/control.html`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<h1>shared-control</h1>');
  });

  it('streams only events of the selected non-local-only plugin', async () => {
    const abort = new AbortController();
    const response = await fetch(`${baseUrl}/gateway/shared-control/events`, {
      signal: abort.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const reader = response.body!.getReader();
    try {
      await fetch(`${baseUrl}/plugins/local-control/api/emit`, { method: 'POST' });
      await fetch(`${baseUrl}/gateway/shared-control/api/emit`, { method: 'POST' });
      const received = await reader.read();
      expect(new TextDecoder().decode(received.value)).toContain(
        JSON.stringify({
          event: 'plugin:shared-control:changed',
          data: [{ value: 7 }],
        }),
      );
      expect(new TextDecoder().decode(received.value)).not.toContain(
        'plugin:local-control:changed',
      );
    } finally {
      abort.abort();
      await reader.cancel().catch(() => undefined);
    }
  });

  it.each(['shared-control', 'local-control'])(
    'preserves the ordinary local API LAN restriction for %s',
    async id => {
      const response = await fetch(`${baseUrl}/plugins/${id}/api/local`, {
        headers: { 'x-test-lan': '1' },
      });
      expect(response.status).toBe(403);
    },
  );

  it('keeps local-only static assets inaccessible directly over LAN', async () => {
    const response = await fetch(`${baseUrl}/plugins/local-control/control.html`, {
      headers: { 'x-test-lan': '1' },
    });
    expect(response.status).toBe(403);
  });

  it('keeps the ordinary local-only control usable on the host', async () => {
    const response = await fetch(`${baseUrl}/plugins/local-control/api/local`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ route: 'local' });
  });
});
