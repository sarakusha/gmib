import { describe, expect, it, vi } from 'vitest';

import { GmibApiError } from '../../../scripts/gmib-api-client.mjs';
import {
  GmibApiResourceError,
  ensureResource,
  normalizeDesired,
} from '../../../scripts/gmib-api-resources.mjs';

const response = data => ({ data, status: 200, serverId: 'fixture-gmib' });

describe('management API resource helper', () => {
  it('creates a screen, applies ignored fields with PUT, and preserves omitted fields on later update', async () => {
    const create = vi.fn(async (_path, options) =>
      response({ id: 7, ...options.body, addresses: [], brightness: undefined }),
    );
    const followup = vi.fn(async (_path, options) => response(options.body));
    const client = {
      request: vi.fn(async (path, options = {}) => {
        if (path === '/api/screen') {
          if (options.method === 'POST') return create(path, options);
          if (options.method === 'PUT') return followup(path, options);
          return response([]);
        }
        throw new Error(`Unexpected ${path}`);
      }),
    };

    await expect(
      ensureResource(client, 'screen', {
        name: 'Main screen',
        left: 0,
        top: 0,
        addresses: ['10.0.0.10'],
        brightness: 75,
      }),
    ).resolves.toMatchObject({ changed: true, id: 7, operations: ['create', 'update'] });
    expect(create).toHaveBeenCalledWith('/api/screen', {
      method: 'POST',
      body: { name: 'Main screen', left: 0, top: 0 },
    });
    expect(followup.mock.calls[0][1].body).toMatchObject({
      id: 7,
      addresses: ['10.0.0.10'],
      brightness: 75,
    });

    const update = vi.fn(async (_path, options) => response(options.body));
    const existing = {
      id: 7,
      name: 'Main screen',
      left: 0,
      top: 0,
      moduleWidth: 64,
      moduleHeight: 32,
      addresses: ['10.0.0.10'],
      brightness: 75,
      downToTop: false,
      rightToLeft: false,
    };
    const updateClient = {
      request: vi.fn(async (path, options = {}) => {
        if (path === '/api/screen' && options.method === 'PUT') return update(path, options);
        if (path === '/api/screen') return response([existing]);
        if (path === '/api/screen/7') return response(existing);
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await ensureResource(updateClient, 'screen', { id: 7, left: 10 });
    expect(update.mock.calls[0][1].body).toMatchObject({
      id: 7,
      left: 10,
      moduleWidth: 64,
      moduleHeight: 32,
      addresses: ['10.0.0.10'],
      brightness: 75,
    });
  });

  it('ignores generated playlist item ids while retaining them across an ordered update', async () => {
    const playlist = {
      id: 3,
      name: 'Morning',
      flags: 0,
      items: [
        { id: 'generated-a', md5: 'a', flags: 0 },
        { id: 'generated-b', md5: 'b', flags: 0 },
      ],
    };
    const put = vi.fn(async (_path, options) => response(options.body));
    const client = {
      request: vi.fn(async (path, options = {}) => {
        if (path === '/api/playlist') {
          if (options.method === 'PUT') return put(path, options);
          return response([playlist]);
        }
        if (path === '/api/playlist/3') return response(playlist);
        if (path === '/api/media') return response([{ md5: 'a' }, { md5: 'b' }]);
        throw new Error(`Unexpected ${path}`);
      }),
    };

    await expect(
      ensureResource(client, 'playlist', {
        id: 3,
        items: [{ md5: 'a' }, { md5: 'b' }],
      }),
    ).resolves.toMatchObject({ changed: false, id: 3 });
    expect(put).not.toHaveBeenCalled();

    await ensureResource(client, 'playlist', {
      id: 3,
      items: [{ md5: 'b' }, { md5: 'a' }],
    });
    expect(put.mock.calls[0][1].body.items.map(item => item.id)).toEqual([
      'generated-b',
      'generated-a',
    ]);
  });

  it('predicts check-mode changes using reads only', async () => {
    const player = { id: 4, name: 'Backup', hidden: false, autoPlay: false };
    const client = {
      request: vi.fn(async path => {
        if (path === '/api/player') return response([player]);
        if (path === '/api/player/4') return response(player);
        throw new Error(`Unexpected ${path}`);
      }),
    };

    await expect(
      ensureResource(client, 'player', { id: 4, hidden: true }, { check: true }),
    ).resolves.toEqual({
      changed: true,
      checkMode: true,
      resource: 'player',
      id: 4,
      predicted: 'update',
    });
    expect(
      client.request.mock.calls.every(
        ([, options]) => !options?.method || options.method === 'GET',
      ),
    ).toBe(true);
  });

  it('keeps explicit numeric ids in player, playlist, and mapping PUT payloads', async () => {
    const player = { id: 4, name: 'Backup', hidden: false, autoPlay: false };
    const mapping = { id: 9, name: 'Output', player: 4, left: 0, top: 0, kiosk: false };
    const playlist = { id: 3, name: 'Morning', flags: 0, items: [] };
    const writes = [];
    const client = {
      request: vi.fn(async (path, options = {}) => {
        if (options.method === 'PUT') {
          writes.push({ path, body: options.body });
          return response(options.body);
        }
        if (path === '/api/player') return response([player]);
        if (path === '/api/player/4') return response(player);
        if (path === '/api/mapping') return response([mapping]);
        if (path === '/api/playlist') return response([playlist]);
        if (path === '/api/playlist/3') return response(playlist);
        throw new Error(`Unexpected ${path}`);
      }),
    };

    await ensureResource(client, 'player', { id: 4, hidden: true });
    await ensureResource(client, 'playlist', { id: 3, flags: 1 });
    await ensureResource(client, 'mapping', { id: 9, left: 12 });
    expect(writes).toEqual([
      expect.objectContaining({
        path: '/api/player',
        body: expect.objectContaining({ id: 4, hidden: true }),
      }),
      expect.objectContaining({
        path: '/api/playlist',
        body: expect.objectContaining({ id: 3, flags: 1 }),
      }),
      expect.objectContaining({
        path: '/api/mapping',
        body: expect.objectContaining({ id: 9, left: 12 }),
      }),
    ]);
  });

  it('fails an ambiguous exact name and checks references before creating a mapping', async () => {
    const ambiguous = {
      request: vi.fn(async path => {
        if (path === '/api/player')
          return response([
            { id: 1, name: 'Same' },
            { id: 2, name: 'Same' },
          ]);
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(ensureResource(ambiguous, 'player', { name: 'Same' })).rejects.toMatchObject({
      code: 'ambiguous_resource',
    });

    const missingReference = {
      request: vi.fn(async path => {
        if (path === '/api/mapping') return response([]);
        if (path === '/api/player/99') {
          throw new GmibApiError('Not Found', { code: 'http_error', status: 404 });
        }
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(
      ensureResource(missingReference, 'mapping', { name: 'Output', player: 99 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(missingReference.request).not.toHaveBeenCalledWith(
      '/api/mapping',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('normalizes scheduler defaults and ignores result history without run-now', async () => {
    const current = {
      id: 'job-1',
      kind: 'cron',
      name: 'Start',
      enabled: false,
      priority: 1,
      action: 'play',
      playerId: 8,
      cron: {
        seconds: { mode: 'select', every: 1, selected: [0] },
        minutes: { mode: 'select', every: 1, selected: [10, 20] },
        hours: { mode: 'all', every: 1, selected: [] },
        days: { mode: 'all', selected: [] },
        months: { mode: 'all', selected: [] },
        weekdays: { mode: 'all', selected: [] },
      },
      lastRunAt: '2026-09-17T00:00:00.000Z',
      lastStatus: 'success',
      nextRunAt: '2026-09-18T00:00:00.000Z',
    };
    const client = {
      request: vi.fn(async path => {
        if (path === '/api/scheduler') return response([current]);
        if (path === '/api/player/8') return response({ id: 8 });
        if (path.includes('/run')) throw new Error('run-now must not be called');
        throw new Error(`Unexpected ${path}`);
      }),
    };

    await expect(
      ensureResource(client, 'scheduler', {
        id: 'job-1',
        priority: 1.9,
        cron: {
          minutes: { mode: 'select', every: 1, selected: [20, 10, 10] },
          hours: { mode: 'all', every: 1, selected: [] },
          days: { mode: 'all', selected: [] },
          months: { mode: 'all', selected: [] },
          weekdays: { mode: 'all', selected: [] },
        },
      }),
    ).resolves.toMatchObject({ changed: false, id: 'job-1' });
    expect(client.request.mock.calls.some(([path]) => path.includes('/run'))).toBe(false);
    expect(client.request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it('deletes only an explicitly absent resource and rejects invalid scheduler time', async () => {
    const client = {
      request: vi.fn(async (path, options = {}) => {
        if (path === '/api/gmib-scheduler') return response([{ id: 'old', name: 'Old' }]);
        if (path === '/api/gmib-scheduler/old' && options.method === 'DELETE')
          return response(null);
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(
      ensureResource(client, 'gmib-scheduler', { id: 'old', state: 'absent' }),
    ).resolves.toMatchObject({
      changed: true,
      operations: ['delete'],
    });
    expect(() => normalizeDesired('scheduler', { id: 'job-2', runAt: 'not-a-date' })).toThrow(
      GmibApiResourceError,
    );
    expect(() =>
      normalizeDesired('scheduler', {
        id: 'job-2',
        cron: {
          minutes: { mode: 'select', every: 1, selected: [0] },
          hours: { mode: 'select', every: 1, selected: [99] },
          days: { mode: 'all', selected: [] },
          months: { mode: 'all', selected: [] },
          weekdays: { mode: 'all', selected: [] },
        },
      }),
    ).toThrow(GmibApiResourceError);
  });

  it('does not create a numeric-id resource that is absent', async () => {
    const client = {
      request: vi.fn(async path => {
        if (path === '/api/player') return response([]);
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(
      ensureResource(client, 'player', { id: 44, name: 'Missing' }),
    ).rejects.toMatchObject({
      code: 'resource_not_found',
    });
    expect(client.request).not.toHaveBeenCalledWith(
      '/api/player',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('validates a create before check mode and reports a created screen when readback disagrees', async () => {
    const invalidCheck = {
      request: vi.fn(async path => {
        if (path === '/api/screen') return response([]);
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(
      ensureResource(invalidCheck, 'screen', { name: 'Incomplete', left: 0 }, { check: true }),
    ).rejects.toMatchObject({ code: 'invalid_screen' });
    expect(invalidCheck.request).not.toHaveBeenCalledWith(
      '/api/screen',
      expect.objectContaining({ method: 'POST' }),
    );

    const partialScreen = {
      request: vi.fn(async (path, options = {}) => {
        if (path === '/api/screen' && !options.method) return response([]);
        if (path === '/api/screen' && options.method === 'POST') {
          return response({
            id: 7,
            name: 'Main',
            left: 0,
            top: 0,
            addresses: [],
            brightness: undefined,
          });
        }
        if (path === '/api/screen' && options.method === 'PUT') {
          return response({ ...options.body, brightness: 50 });
        }
        throw new Error(`Unexpected ${path}`);
      }),
    };
    await expect(
      ensureResource(partialScreen, 'screen', {
        name: 'Main',
        left: 0,
        top: 0,
        addresses: ['10.0.0.10'],
        brightness: 75,
      }),
    ).rejects.toMatchObject({
      code: 'screen_followup_failed',
      createdId: 7,
      operations: ['create'],
    });
  });
});
