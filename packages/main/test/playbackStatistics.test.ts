import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import type { PlaybackStatisticsEvent } from '/@common/playback';
import {
  aggregatePlaybackHistory,
  aggregatePlaybackStatistics,
  statisticsPeriod,
} from '../src/playbackStatistics';

const now = new Date('2026-10-09T18:00:00.000Z');
const query = { playerId: 1, from: '2026-10-01', to: '2026-10-09' };
const originalTZ = process.env.TZ;
process.env.TZ = 'UTC';
const event = (
  playbackId: string,
  kind: PlaybackStatisticsEvent['event'],
  timestamp: string,
  extra: Partial<PlaybackStatisticsEvent> = {},
): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId,
  event: kind,
  timestamp,
  playerId: 1,
  mediaId: 'md5-a',
  filename: 'clip.mp4',
  attempt: 1,
  output: {
    outputs: [{ id: 10, name: 'Screen', display: 5, resolvedDisplayId: 5, state: 'showing' }],
  },
  ...(kind === 'completed'
    ? {
        outputResult: {
          status: 'confirmed' as const,
          reasons: [],
          outputs: [
            {
              id: 10,
              name: 'Screen',
              display: 5,
              resolvedDisplayId: 5,
              state: 'showing' as const,
              status: 'confirmed' as const,
              reasons: [],
            },
          ],
        },
      }
    : {}),
  ...(kind === 'error' ? { error: 'Decoder failed' } : {}),
  ...extra,
});
const successful = (start = '2026-10-08T10:00:00.000Z', end = '2026-10-08T10:00:10.000Z') => {
  const id = randomUUID();
  return [
    event(id, 'started', start),
    event(id, 'progress', end, {
      segmentStartedAt: start,
      playedMs: Date.parse(end) - Date.parse(start),
    }),
    event(id, 'completed', end),
  ];
};
afterEach(() => {
  process.env.TZ = 'UTC';
});

// Restore the process-wide test setting when this suite is unloaded.
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('playback statistics', () => {
  it('counts errors independently, excludes failed time, and clips to this player history', async () => {
    const failed = randomUUID();
    const events = [
      ...successful(),
      event(failed, 'started', '2026-10-08T11:00:00.000Z'),
      event(failed, 'progress', '2026-10-08T11:00:04.000Z', {
        segmentStartedAt: '2026-10-08T11:00:00.000Z',
        playedMs: 4000,
      }),
      event(failed, 'error', '2026-10-08T11:00:04.000Z'),
      event(failed, 'skipped', '2026-10-08T11:00:04.000Z', { reason: 'error' }),
      event(randomUUID(), 'error', '2026-10-08T09:00:00.000Z'),
      event(randomUUID(), 'started', '2026-10-01T01:00:00.000Z', { playerId: 2 }),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals).toEqual({
      starts: 2,
      completed: 1,
      confirmed: 1,
      partial: 0,
      unconfirmed: 0,
      playedMs: 14000,
      errors: 2,
      skipped: 1,
      interrupted: 0,
      successfulMs: 10000,
    });
    expect(result.available).toEqual({
      from: '2026-10-08T09:00:00.000Z',
      to: '2026-10-08T11:00:04.000Z',
    });
    expect(result.clipped).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it('does not credit pause or seek gaps; manual interruption is not an error skip', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'started', '2026-10-08T10:00:00.000Z'),
      event(id, 'progress', '2026-10-08T10:00:03.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 3000,
      }),
      event(id, 'paused', '2026-10-08T10:00:03.000Z'),
      event(id, 'resumed', '2026-10-08T10:05:00.000Z'),
      event(id, 'progress', '2026-10-08T10:05:02.000Z', {
        segmentStartedAt: '2026-10-08T10:05:00.000Z',
        playedMs: 2000,
      }),
      event(id, 'completed', '2026-10-08T10:05:02.000Z'),
      event(randomUUID(), 'interrupted', '2026-10-08T10:06:00.000Z', { reason: 'manual-next' }),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals.successfulMs).toBe(5000);
    expect(result.totals.interrupted).toBe(1);
    expect(result.totals.skipped).toBe(0);
  });

  it('splits midnight intervals, counts starts and ends at their own timestamps', async () => {
    const events = successful('2026-10-07T23:59:55.000Z', '2026-10-08T00:00:05.000Z');
    const all = await aggregatePlaybackStatistics(events, query, now);
    expect(all.days.map(day => [day.date, day.starts, day.completed, day.successfulMs])).toEqual([
      ['2026-10-07', 1, 0, 5000],
      ['2026-10-08', 0, 1, 5000],
    ]);
    const lastDay = await aggregatePlaybackStatistics(
      events,
      { playerId: 1, from: '2026-10-08', to: '2026-10-08' },
      now,
    );
    expect(lastDay.totals.starts).toBe(0);
    expect(lastDay.totals.completed).toBe(1);
    expect(lastDay.totals.successfulMs).toBe(5000);
  });

  it('ignores duplicate delivery and overlapping segments', async () => {
    const events = successful();
    events.push(events[1], events[2], { ...events[1], eventId: randomUUID() });
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals.successfulMs).toBe(10000);
    expect(result.totals.completed).toBe(1);
  });

  it('does not turn unfinished attempts into skips or successful airtime', async () => {
    const events = successful().slice(0, 2);
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals.successfulMs).toBe(0);
    expect(result.totals.skipped).toBe(0);
    expect(result.quality.incompleteAttempts).toBe(1);
  });

  it('does not invent missing starts when only a retained progress and completion remain', async () => {
    const result = await aggregatePlaybackStatistics(successful().slice(1), query, now);
    expect(result.totals.starts).toBe(0);
    expect(result.totals.completed).toBe(1);
    expect(result.totals.successfulMs).toBe(10000);
  });

  it('returns empty outside history, and marks interior days with no records', async () => {
    const events = [
      ...successful('2026-10-05T10:00:00.000Z', '2026-10-05T10:00:10.000Z'),
      ...successful(),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.days.filter(day => !day.hasRecords).map(day => day.date)).toEqual([
      '2026-10-06',
      '2026-10-07',
    ]);
    const empty = await aggregatePlaybackStatistics(
      events,
      { playerId: 1, from: '2026-09-01', to: '2026-09-30' },
      now,
    );
    expect(empty.effective).toBeNull();
    expect(empty.rows).toEqual([]);
  });

  it('uses the host calendar across DST instead of adding 24 hours', () => {
    process.env.TZ = 'America/New_York';
    const period = statisticsPeriod({ playerId: 1, from: '2026-11-01', to: '2026-11-01' }, now);
    expect(period.to - period.from).toBe(25 * 3600000);
    expect(() => statisticsPeriod({ ...query, from: '2026-02-30' }, now)).toThrow(
      'Invalid calendar date',
    );
    expect(() => statisticsPeriod({ ...query, from: '2026-10-10' }, now)).toThrow(
      'Period end precedes start',
    );
  });

  it('paginates details and retains the failed partial airtime outside successful totals', async () => {
    const id = randomUUID();
    const events = [
      ...successful(),
      event(id, 'progress', '2026-10-08T11:00:04.000Z', {
        segmentStartedAt: '2026-10-08T11:00:00.000Z',
        playedMs: 4000,
      }),
      event(id, 'error', '2026-10-08T11:00:04.000Z'),
      event(id, 'skipped', '2026-10-08T11:00:04.000Z'),
    ];
    const history = await aggregatePlaybackHistory(
      events,
      { ...query, mediaId: 'md5-a', limit: 1 },
      now,
    );
    expect(history.total).toBe(2);
    expect(history.entries[0]).toMatchObject({ outcome: 'error', playedMs: 4000, skipped: true });
    expect(history.entries[0].events.map(entry => entry.event)).toEqual(['error', 'skipped']);
    await expect(
      aggregatePlaybackHistory(events, { ...query, mediaId: 'md5-a', limit: 101 }, now),
    ).rejects.toThrow('Invalid history');
  });
});
