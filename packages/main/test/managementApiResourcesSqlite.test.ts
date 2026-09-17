import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

const mocks = await vi.hoisted(async () => ({
  root: await (async () => {
    const fsModule = await import('node:fs/promises');
    const osModule = await import('node:os');
    const pathModule = await import('node:path');
    return fsModule.mkdtemp(pathModule.join(osModule.tmpdir(), 'gmib-resource-sqlite-'));
  })(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.root),
    on: vi.fn(),
    quit: vi.fn(),
  },
}));
vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { ensureResource } from '../../../scripts/gmib-api-resources.mjs';
import { closeDatabase, dbReady } from '../src/db';
import {
  deleteExtraAddresses,
  existsAddress,
  getAddressesForScreen,
  getPlayer,
  getPlayers,
  getScreens,
  insertAddress,
  insertPlayer,
  insertScreen,
  loadScreen,
  updatePlayer,
  updateScreen,
} from '../src/screen';
import {
  getPlayerMappingById,
  getPlayerMappings,
  insertPlayerMapping,
  updatePlayerMapping,
} from '../src/playerMapping';

const response = <T>(data: T) => ({ data, status: 200, serverId: 'sqlite-fixture' });

const screenList = async () =>
  Promise.all(
    (await getScreens()).map(async screen => ({
      ...screen,
      addresses: await getAddressesForScreen(screen.id),
    })),
  );

const client = {
  request: async (requestPath: string, options: { method?: string; body?: any } = {}) => {
    const { method, body } = options;
    if (requestPath === '/api/screen') {
      if (!method) return response(await screenList());
      if (method === 'POST') {
        const { lastID } = await insertScreen(body);
        return response(await loadScreen(lastID));
      }
      if (method === 'PUT') {
        const { addresses, ...screen } = body;
        await updateScreen(screen);
        if (addresses?.length) {
          await Promise.all(
            addresses.map(async (address: string) => {
              if (!(await existsAddress(screen.id, address)))
                await insertAddress(screen.id, address);
            }),
          );
        }
        await deleteExtraAddresses(screen.id, addresses);
        return response(await loadScreen(screen.id));
      }
    }
    if (requestPath.startsWith('/api/screen/'))
      return response(await loadScreen(+requestPath.slice(12)));

    if (requestPath === '/api/player') {
      if (!method) return response(await getPlayers());
      if (method === 'POST') {
        const { lastID } = await insertPlayer(body);
        return response(await getPlayer(lastID));
      }
      if (method === 'PUT') {
        await updatePlayer(body);
        return response(await getPlayer(body.id));
      }
    }
    if (requestPath.startsWith('/api/player/'))
      return response(await getPlayer(+requestPath.slice(12)));

    if (requestPath === '/api/mapping') {
      if (!method) return response(await getPlayerMappings());
      if (method === 'POST') {
        const { lastID } = await insertPlayerMapping(body);
        return response(await getPlayerMappingById(lastID));
      }
      if (method === 'PUT') {
        const { id, ...mapping } = body;
        await updatePlayerMapping(id, mapping);
        return response(await getPlayerMappingById(id));
      }
    }
    throw new Error(`Unexpected ${method ?? 'GET'} ${requestPath}`);
  },
};

afterAll(async () => {
  await closeDatabase();
  await fs.rm(mocks.root, { recursive: true, force: true });
});

describe('management resource helper with production SQLite serializers', () => {
  it('creates a screen without unsupported POST brightness, follows up addresses/brightness, then no-ops', async () => {
    await dbReady;
    await expect(
      insertScreen({ name: 'unsupported brightness', left: 0, top: 0, brightness: 70 }),
    ).rejects.toMatchObject({ code: 'SQLITE_RANGE' });

    const desired = {
      name: 'SQLite screen',
      left: 10,
      top: 20,
      addresses: ['10.20.0.10'],
      brightness: 70,
    };
    const created = await ensureResource(client, 'screen', desired);
    expect(created).toMatchObject({ changed: true, operations: ['create', 'update'] });
    await expect(loadScreen(created.id)).resolves.toMatchObject({
      addresses: desired.addresses,
      brightness: 70,
    });
    await expect(ensureResource(client, 'screen', desired)).resolves.toMatchObject({
      changed: false,
      id: created.id,
    });
  });

  it('clears nullable player values while retaining production width and height', async () => {
    const created = await ensureResource(client, 'player', { name: 'SQLite player' });
    const desired = {
      id: created.id,
      playlistId: null,
      current: null,
      width: 1920,
      height: 1080,
    };
    await expect(ensureResource(client, 'player', desired)).resolves.toMatchObject({
      changed: true,
      operations: ['update'],
    });
    await expect(getPlayer(created.id)).resolves.toMatchObject({ width: 1920, height: 1080 });
    await expect(ensureResource(client, 'player', desired)).resolves.toMatchObject({
      changed: false,
      id: created.id,
    });
  });

  it('merges a mapping update and preserves serializer-backed fields', async () => {
    const player = await ensureResource(client, 'player', { name: 'Mapping player' });
    const created = await ensureResource(client, 'mapping', {
      name: 'SQLite mapping',
      player: player.id,
      width: 800,
      height: 600,
      left: 1,
      top: 2,
      zIndex: 3,
    });
    const desired = { id: created.id, left: 50 };
    await expect(ensureResource(client, 'mapping', desired)).resolves.toMatchObject({
      changed: true,
      operations: ['update'],
    });
    await expect(getPlayerMappingById(created.id)).resolves.toMatchObject({
      left: 50,
      top: 2,
      width: 800,
      height: 600,
      zIndex: 3,
    });
    await expect(ensureResource(client, 'mapping', desired)).resolves.toMatchObject({
      changed: false,
      id: created.id,
    });
  });
});
