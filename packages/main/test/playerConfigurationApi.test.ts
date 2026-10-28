import { createServer, type Server } from 'node:http';

import express, { type ErrorRequestHandler } from 'express';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import generateSignature from '/@common/generateSignature';

const mocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  updateMenu: vi.fn(),
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn(),
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
}));
vi.mock('../src/playerConfiguration', () => ({
  exportPlayerConfiguration: mocks.exportConfiguration,
  importPlayerConfiguration: mocks.importConfiguration,
}));
vi.mock('../src/server', () => ({ broadcast: mocks.broadcast }));
vi.mock('../src/mainMenu', () => ({ default: mocks.updateMenu }));
vi.mock('../src/getAllDisplays', () => ({ default: () => [{ id: 1, primary: true }] }));
vi.mock('../src/localConfig', () => ({ default: { get: () => 'server-identifier' } }));
vi.mock('../src/secret', () => ({
  default: mocks.localSecret,
  getIncomingSecretWithRevision: async () => ({ revision: 0, secret: mocks.remoteSecret }),
}));

import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import {
  mountPlayerConfigurationApi,
  playerConfigurationJson,
} from '../src/playerConfigurationApi';

const document = () => ({
  format: 'gmib-player-configuration',
  version: 1,
  players: [{ settings: { name: 'Player' }, mappings: [] }],
});

const servers: Server[] = [];
const authorization = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };
const startApi = async (status = 'active') => {
  const app = express();
  app.use('/api/player-configuration', playerConfigurationJson);
  app.use(express.json());
  const api = express.Router();
  mountApiAuth(api, {
    auth,
    getLicenseStatus: () => status,
    srpRouter: express.Router(),
    unsafeMode: false,
  });
  mountPlayerConfigurationApi(api);
  app.use('/api', api);
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error.status ?? 500).json({ message: error.message });
  };
  app.use(handleError);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not start');
  return `http://127.0.0.1:${address.port}/api/player-configuration`;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exportConfiguration.mockResolvedValue(document());
  mocks.importConfiguration.mockResolvedValue({ playerIds: [5], mappingCount: 0 });
});
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) => {
          server.close(error => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});

it('requires authentication and applies the player license gate to imports', async () => {
  const url = await startApi('unlicensed');
  expect((await fetch(url)).status).toBe(401);
  expect((await fetch(url, { headers: authorization })).status).toBe(200);
  expect(
    (
      await fetch(url, {
        method: 'POST',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify(document()),
      })
    ).status,
  ).toBe(403);
  expect(mocks.importConfiguration).not.toHaveBeenCalled();
});

it('reads a new export for every authenticated request', async () => {
  const url = await startApi();
  await fetch(url, { headers: authorization });
  await fetch(url, { headers: authorization });
  expect(mocks.exportConfiguration).toHaveBeenCalledTimes(2);
  expect(mocks.exportConfiguration).toHaveBeenCalledWith([{ id: 1, primary: true }]);
});

it('rejects invalid documents without importing or broadcasting', async () => {
  const url = await startApi();
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ ...document(), version: 2 }),
  });
  expect(response.status).toBe(400);
  expect(mocks.importConfiguration).not.toHaveBeenCalled();
  expect(mocks.broadcast).not.toHaveBeenCalled();
  expect(mocks.updateMenu).not.toHaveBeenCalled();
});

it('broadcasts player and mapping changes only after the import commits', async () => {
  const url = await startApi();
  let resolveImport!: (result: { playerIds: number[]; mappingCount: number }) => void;
  let signalImport!: () => void;
  const imported = new Promise<void>(resolve => {
    signalImport = resolve;
  });
  mocks.importConfiguration.mockImplementation(() => {
    signalImport();
    return new Promise(resolve => {
      resolveImport = resolve;
    });
  });
  const request = fetch(url, {
    method: 'POST',
    headers: { ...authorization, 'content-type': 'application/json' },
    body: JSON.stringify(document()),
  });
  await imported;
  expect(mocks.broadcast).not.toHaveBeenCalled();
  expect(mocks.updateMenu).not.toHaveBeenCalled();
  resolveImport({ playerIds: [7], mappingCount: 3 });
  const response = await request;
  expect(await response.json()).toEqual({ playerIds: [7], mappingCount: 3 });
  expect(mocks.broadcast.mock.calls.map(([event]) => event.event)).toEqual(['player', 'mapping']);
  expect(mocks.updateMenu).toHaveBeenCalledOnce();
});

it('does not broadcast or refresh the menu after an import failure', async () => {
  const url = await startApi();
  mocks.importConfiguration.mockRejectedValue(new Error('transaction rolled back'));
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...authorization, 'content-type': 'application/json' },
    body: JSON.stringify(document()),
  });
  expect(response.status).toBe(500);
  expect(mocks.broadcast).not.toHaveBeenCalled();
  expect(mocks.updateMenu).not.toHaveBeenCalled();
});

it('authenticates signed documents larger than the normal JSON parser limit', async () => {
  const url = await startApi();
  const body = { ...document(), warnings: ['x'.repeat(200 * 1024)] };
  const timestamp = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ni-identifier': 'remote-identifier',
      'x-ni-timestamp': String(timestamp),
      'x-ni-signature': generateSignature(
        mocks.remoteSecret,
        'POST',
        '/api/player-configuration',
        timestamp,
        body,
      ),
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  expect(mocks.importConfiguration).toHaveBeenCalledOnce();
});

it('rejects documents exceeding 5 MiB before importing', async () => {
  const url = await startApi();
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ ...document(), warnings: ['x'.repeat(5 * 1024 * 1024)] }),
  });
  expect(response.status).toBe(413);
  expect(mocks.importConfiguration).not.toHaveBeenCalled();
});
