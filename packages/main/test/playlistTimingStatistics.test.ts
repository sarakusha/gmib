import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isPlaybackEvent, type PlaybackStatisticsEvent } from '/@common/playback';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

const now = new Date('2026-11-17T12:00:00.000Z');
const sample = (overrides: Partial<PlaybackStatisticsEvent> = {}): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId: randomUUID(),
  playerId: 1,
  playlistId: 2,
  itemId: 'last-item',
  mediaId: 'clip',
  attempt: 1,
  event: 'completed',
  timestamp: now.toISOString(),
  playlistTiming: { signature: '["playlist-v1"]', elapsedMs: 10_000 },
  ...overrides,
});
const stores: PlaybackStatisticsStore[] = [];
const directories: string[] = [];
const create = (filename = ':memory:', options = {}) => {
  const store = new PlaybackStatisticsStore(filename, { now: () => now, ...options });
  stores.push(store);
  return store;
};
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
  await Promise.all(directories.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe('playlist timing statistics', () => {
  it('validates optional timing only on completed version 3 events with a playlist', () => {
    expect(isPlaybackEvent(sample())).toBe(true);
    expect(isPlaybackEvent(sample({ playlistTiming: undefined }))).toBe(true);
    expect(isPlaybackEvent(sample({ event: 'started' }))).toBe(false);
    expect(isPlaybackEvent(sample({ playlistId: undefined }))).toBe(false);
    expect(isPlaybackEvent(sample({ version: undefined, eventId: undefined }))).toBe(false);
    for (const elapsedMs of [NaN, Infinity, 0, -1, 7 * 86_400_000 + 1])
      expect(isPlaybackEvent(sample({ playlistTiming: { signature: 'v1', elapsedMs } }))).toBe(
        false,
      );
    for (const signature of ['', 'x'.repeat(65_537)])
      expect(isPlaybackEvent(sample({ playlistTiming: { signature, elapsedMs: 1 } }))).toBe(false);
  });

  it('deduplicates events and attempts, groups variants and players, and computes odd/even medians', async () => {
    const store = create();
    const first = sample({ playlistTiming: { signature: 'v1', elapsedMs: 1000 } });
    await store.append(first);
    await store.append(first);
    await store.append({ ...first, eventId: randomUUID() });
    await store.append(sample({ playlistTiming: { signature: 'v1', elapsedMs: 3000 } }));
    await store.append(sample({ playlistTiming: { signature: 'v1', elapsedMs: 20_000 } }));
    await store.append(sample({ playlistTiming: { signature: 'v2', elapsedMs: 6000 } }));
    await store.append(sample({ playlistTiming: { signature: 'v2', elapsedMs: 8000 } }));
    await store.append(sample({ playerId: 9 }));
    expect(await store.playlistTiming(1)).toEqual({
      playerId: 1,
      samples: [
        { playlistId: 2, signature: 'v1', medianElapsedMs: 3000, sampleCount: 3 },
        { playlistId: 2, signature: 'v2', medianElapsedMs: 7000, sampleCount: 2 },
      ],
    });
    expect((await store.playlistTiming(9)).samples).toHaveLength(1);
  });

  it('uses only the last 20 passes within seven days and excludes future observations', async () => {
    const store = create();
    await store.append(sample({ timestamp: new Date(+now - 8 * 86_400_000).toISOString() }));
    await store.append(sample({ timestamp: new Date(+now + 1).toISOString() }));
    for (let index = 0; index < 25; index += 1) {
      await store.append(
        sample({
          timestamp: new Date(+now - (25 - index) * 1000).toISOString(),
          playlistTiming: { signature: 'v1', elapsedMs: (index + 1) * 1000 },
        }),
      );
    }
    expect((await store.playlistTiming(1)).samples).toEqual([
      { playlistId: 2, signature: 'v1', medianElapsedMs: 15_500, sampleCount: 20 },
    ]);
    expect(
      await store.read(sql =>
        sql.get("SELECT COUNT(*) AS count FROM playlist_timing WHERE signature='v1'"),
      ),
    ).toEqual({ count: 20 });
    // Pruning the estimate must not remove the underlying playback history.
    expect(
      await store.read(sql =>
        sql.get("SELECT COUNT(*) AS count FROM attempts WHERE media_id='clip'"),
      ),
    ).toEqual({ count: 27 });
  });

  it('persists through reopening and removes timing with retention and attempt deletion', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-playlist-timing-'));
    directories.push(dir);
    const filename = path.join(dir, 'playback.sqlite');
    const store = create(filename);
    const event = sample();
    await store.append(event);
    await store.close();
    const reopened = create(filename);
    expect((await reopened.playlistTiming(1)).samples[0]?.sampleCount).toBe(1);
    await reopened.write(sql => sql.run('DELETE FROM attempts WHERE id=?', [event.playbackId]));
    expect((await reopened.playlistTiming(1)).samples).toEqual([]);
    await reopened.append(sample());
    await reopened.close();
    const expired = create(filename, { now: () => new Date(+now + 31 * 86_400_000) });
    expect(
      await expired.read(sql => sql.get('SELECT COUNT(*) AS count FROM playlist_timing')),
    ).toEqual({ count: 0 });
  });
});
