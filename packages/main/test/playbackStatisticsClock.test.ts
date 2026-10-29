import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import { PlaybackStatisticsSqlReader } from '../src/playbackStatisticsSql';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

const base = Date.parse('2026-10-29T12:00:00.000Z');
const iso = (at: number) => new Date(at).toISOString();
const query = { playerId: 1, from: '2026-10-29', to: '2026-10-29' };
const event = (
  playbackId: string,
  kind: 'started' | 'completed',
  at: number,
  startedAt: number,
): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId,
  playerId: 1,
  mediaId: 'clip',
  attempt: 1,
  event: kind,
  timestamp: iso(at),
  startedAt: iso(startedAt),
});

const stores: PlaybackStatisticsStore[] = [];
const directories: string[] = [];
const create = (now: () => Date, filename = ':memory:') => {
  const store = new PlaybackStatisticsStore(filename, { now });
  stores.push(store);
  return { store, reader: new PlaybackStatisticsSqlReader(store, now) };
};
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
  await Promise.all(
    directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('playback facts across process clock differences', () => {
  it.each([1, 15, 60_000])(
    'preserves events %i ms ahead without counting them early',
    async skew => {
      let clock = base;
      const { store, reader } = create(() => new Date(clock));
      const id = randomUUID();
      const startedAt = base + skew;
      const start = event(id, 'started', startedAt, startedAt);
      await store.append(start);
      expect(await store.read(db => db.get('SELECT at FROM events'))).toEqual({ at: startedAt });
      expect((await reader.statistics(query)).totals).toMatchObject({ starts: 0, completed: 0 });
      expect((await reader.history({ ...query, mediaId: 'clip' })).total).toBe(0);

      clock = startedAt;
      expect((await reader.statistics(query)).totals).toMatchObject({ starts: 1, completed: 0 });
      clock = base + 30_000;
      const completedAt = clock + skew;
      const completed = event(id, 'completed', completedAt, startedAt);
      await store.append(completed);
      // Cleanup must retain recorded facts even while the writer's clock is behind them.
      await store.cleanup();
      expect((await reader.statistics(query)).totals.completed).toBe(0);

      clock = completedAt;
      await store.append(start);
      await store.append(completed);
      expect((await reader.statistics(query)).totals).toMatchObject({
        starts: 1,
        completed: 1,
        playedMs: 30_000,
      });
      expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM events'))).toEqual({
        count: 2,
      });
      const history = await reader.history({ ...query, mediaId: 'clip' });
      expect(history.entries[0].events.map(record => record.timestamp)).toEqual([
        iso(startedAt),
        iso(completedAt),
      ]);
    },
  );

  it('keeps both facts when the clock moves backwards without inventing played time', async () => {
    let clock = base;
    const { store, reader } = create(() => new Date(clock));
    const id = randomUUID();
    await store.append(event(id, 'started', base, base));
    clock -= 60_000;
    // Renderer and main process may observe the clock correction at different times.
    await store.append(event(id, 'completed', clock + 1, base));
    clock += 1;
    expect((await reader.statistics(query)).totals).toMatchObject({
      starts: 0,
      completed: 1,
      playedMs: 0,
    });
    clock = base;
    expect((await reader.statistics(query)).totals).toMatchObject({
      starts: 1,
      completed: 1,
      playedMs: 0,
    });
  });

  it('retains future facts across restart and still expires facts outside retention', async () => {
    let clock = base;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-clock-'));
    directories.push(directory);
    const filename = path.join(directory, 'playback.sqlite');
    const { store } = create(() => new Date(clock), filename);
    const start = event(randomUUID(), 'started', base + 1, base + 1);
    await store.append(start);
    const expired = base - 31 * 24 * 60 * 60 * 1000;
    await store.append(event(randomUUID(), 'started', expired, expired));
    await store.close();
    const reopened = create(() => new Date(clock), filename);
    expect(await reopened.store.read(db => db.get('SELECT at FROM events'))).toEqual({
      at: base + 1,
    });
    expect((await reopened.reader.statistics(query)).totals.starts).toBe(0);
    clock += 1;
    expect((await reopened.reader.statistics(query)).totals.starts).toBe(1);
  });
});
