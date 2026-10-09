import { createServer, type Server } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { mountPlaybackStatisticsApi } from '../src/playbackStatisticsApi';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

let server: Server | undefined;
let directory: string | undefined;
let store: PlaybackStatisticsStore | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server!.close(error => (error ? reject(error) : resolve()));
    });
  server = undefined;
  await store?.close();
  store = undefined;
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

describe('playback statistics API', () => {
  it('validates dates/player/pagination and keeps normal host authentication ahead of reads', async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-statistics-api-'));
    store = new PlaybackStatisticsStore(path.join(directory, 'playback.sqlite'));
    const app = express();
    const router = express.Router();
    router.use((req, res, next) => {
      if (req.get('Authorization') !== 'Bearer test-only') res.sendStatus(401);
      else next();
    });
    mountPlaybackStatisticsApi(router, () => store!);
    app.use('/api', router);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    const base = `http://127.0.0.1:${address.port}/api/playback/statistics`;
    const headers = { Authorization: 'Bearer test-only' };
    expect((await fetch(`${base}?playerId=1`)).status).toBe(401);
    const response = await fetch(`${base}?playerId=1`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      playerId: 1,
      available: null,
      rows: [],
      totals: { successfulMs: 0 },
    });
    for (const suffix of [
      '',
      '?playerId=abc',
      '?playerId=1&outputId=-1',
      '?playerId=1&outputId=abc',
      '?playerId=1&outputId=1&outputId=2',
      '?playerId=-1',
      '?playerId=1&playerId=2',
      '?playerId=1&from=2026-10-01',
      '?playerId=1&from=2026-02-30&to=2026-10-01',
      '?playerId=1&from=2026-10-10&to=2026-10-01',
      '/history?playerId=1',
      '/history?playerId=1&mediaId=x&limit=101',
      '/history?playerId=1&mediaId=x&offset=-1',
      '/history?playerId=1&mediaId=x&offset=10001',
    ])
      expect((await fetch(base + suffix, { headers })).status, suffix).toBe(400);
    const history = await fetch(`${base}/history?playerId=1&mediaId=x`, { headers });
    expect(history.status).toBe(200);
    expect(await history.json()).toMatchObject({ entries: [], total: 0, offset: 0, limit: 50 });
  });
});
