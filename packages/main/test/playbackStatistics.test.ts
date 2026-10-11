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
    expect(result.durationBasis).toBe('wall-clock');
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

  it('includes pause and seek gaps in wall time; manual interruption is not an error skip', async () => {
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
    expect(result.totals.playedMs).toBe(302000);
    expect(result.totals.successfulMs).toBe(302000);
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
    expect(result.totals.playedMs).toBe(0);
    expect(result.totals.skipped).toBe(0);
    expect(result.quality.incompleteAttempts).toBe(1);
  });

  it('does not infer a missing start from retained progress segments', async () => {
    const result = await aggregatePlaybackStatistics(successful().slice(1), query, now);
    expect(result.totals.starts).toBe(0);
    expect(result.totals.completed).toBe(1);
    expect(result.totals.playedMs).toBe(0);
    expect(result.totals.successfulMs).toBe(0);
    expect(result.quality.incompleteAttempts).toBe(1);
  });

  it('credits a complete start and terminal without progress and ignores legacy durations', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'started', '2026-10-08T10:00:00.000Z'),
      event(id, 'completed', '2026-10-08T10:00:10.000Z', { playedMs: 99 }),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals).toMatchObject({ playedMs: 10000, successfulMs: 10000, completed: 1 });
    expect(result.quality.incompleteAttempts).toBe(0);
    const history = await aggregatePlaybackHistory(events, { ...query, mediaId: 'md5-a' }, now);
    expect(history.entries[0]).toMatchObject({ playedMs: 10000, successfulMs: 10000 });
    events.push(
      event(id, 'progress', '2026-10-08T10:00:05.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 900000,
      }),
    );
    const legacy = await aggregatePlaybackStatistics(events, query, now);
    expect(legacy.totals).toMatchObject({ playedMs: 10000, successfulMs: 10000 });
  });

  it('uses the earliest declared start only when no observed start exists and extends coverage', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'paused', '2026-10-08T10:00:07.000Z', { startedAt: '2026-10-08T10:00:02.000Z' }),
      event(id, 'completed', '2026-10-08T10:00:10.000Z', { startedAt: '2026-10-08T10:00:00.000Z' }),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.available?.from).toBe('2026-10-08T10:00:00.000Z');
    expect(result.totals).toMatchObject({ starts: 0, playedMs: 10000, successfulMs: 10000 });
    expect(result.quality.incompleteAttempts).toBe(0);
    const observed = await aggregatePlaybackStatistics(
      [event(id, 'started', '2026-10-08T10:00:05.000Z'), ...events],
      query,
      now,
    );
    expect(observed.available?.from).toBe('2026-10-08T10:00:05.000Z');
    expect(observed.totals.playedMs).toBe(5000);
  });

  it('ends at the first terminal even if a later completion is counted', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'started', '2026-10-08T10:00:00.000Z'),
      event(id, 'error', '2026-10-08T10:00:04.000Z'),
      event(id, 'completed', '2026-10-08T10:00:10.000Z'),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals).toMatchObject({
      playedMs: 4000,
      successfulMs: 0,
      completed: 1,
      errors: 1,
    });
    const history = await aggregatePlaybackHistory(events, { ...query, mediaId: 'md5-a' }, now);
    expect(history.entries[0]).toMatchObject({ outcome: 'error', playedMs: 4000, successfulMs: 0 });
    expect(history.entries[0].events.map(item => item.event)).toEqual([
      'started',
      'error',
      'completed',
    ]);
  });

  it('credits successful wall time only for the confirmed scoped terminal result', async () => {
    const id = randomUUID();
    const completed = event(id, 'completed', '2026-10-08T10:00:10.000Z');
    completed.outputResult!.status = 'partial';
    completed.outputResult!.outputs.push({
      id: 11,
      name: 'Other',
      display: 6,
      state: 'unknown',
      status: 'unconfirmed',
      reasons: ['unknown'],
    });
    const events = [event(id, 'started', '2026-10-08T10:00:00.000Z'), completed];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals).toMatchObject({ playedMs: 10000, successfulMs: 0, partial: 1 });
    expect(result.outputs.map(output => [output.id, output.playedMs, output.successfulMs])).toEqual(
      [
        [10, 10000, 10000],
        [11, 10000, 0],
      ],
    );
    for (const [outputId, successfulMs] of [
      [10, 10000],
      [11, 0],
    ]) {
      const history = await aggregatePlaybackHistory(
        events,
        { ...query, mediaId: 'md5-a', outputId },
        now,
      );
      expect(history.entries[0].successfulMs).toBe(successfulMs);
    }
    completed.outputResult!.status = 'unconfirmed';
    const unconfirmed = await aggregatePlaybackStatistics(events, query, now);
    expect(unconfirmed.totals).toMatchObject({ playedMs: 10000, successfulMs: 0, unconfirmed: 1 });
  });

  it('returns zero duration for a completion with missing or reversed start', async () => {
    const missing = event(randomUUID(), 'completed', '2026-10-08T10:00:10.000Z');
    const reversed = event(randomUUID(), 'completed', '2026-10-08T11:00:10.000Z', {
      startedAt: '2026-10-08T11:00:20.000Z',
    });
    const result = await aggregatePlaybackStatistics([missing, reversed], query, now);
    expect(result.totals).toMatchObject({ playedMs: 0, successfulMs: 0, completed: 2 });
    expect(result.quality.incompleteAttempts).toBe(2);
    const history = await aggregatePlaybackHistory(
      [missing, reversed],
      { ...query, mediaId: 'md5-a' },
      now,
    );
    expect(history.entries.every(item => item.playedMs === 0 && item.successfulMs === 0)).toBe(
      true,
    );
  });

  it('bounds interrupted wall time and gives pending attempts no invented end', async () => {
    const stopped = randomUUID();
    const pending = randomUUID();
    const events = [
      event(stopped, 'started', '2026-10-08T10:00:00.000Z'),
      event(stopped, 'interrupted', '2026-10-08T10:00:04.000Z'),
      event(pending, 'started', '2026-10-08T11:00:00.000Z'),
      event(pending, 'skipped', '2026-10-08T11:00:06.000Z'),
    ];
    const result = await aggregatePlaybackStatistics(events, query, now);
    expect(result.totals).toMatchObject({
      playedMs: 4000,
      successfulMs: 0,
      interrupted: 1,
      skipped: 1,
    });
    expect(result.quality.incompleteAttempts).toBe(1);
    const history = await aggregatePlaybackHistory(events, { ...query, mediaId: 'md5-a' }, now);
    expect(history.entries.find(item => item.playbackId === stopped)).toMatchObject({
      playedMs: 4000,
      outcome: 'interrupted',
    });
    expect(history.entries.find(item => item.playbackId === pending)).toMatchObject({
      playedMs: 0,
      outcome: 'pending',
    });
  });

  it('includes a whole requested day and its output when wall interval endpoints are outside it', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'started', '2026-10-07T23:00:00.000Z'),
      event(id, 'completed', '2026-10-09T01:00:00.000Z'),
    ];
    const dayQuery = { playerId: 1, from: '2026-10-08', to: '2026-10-08' };
    const result = await aggregatePlaybackStatistics(events, dayQuery, now);
    expect(result.totals).toMatchObject({
      playedMs: 86400000,
      successfulMs: 86400000,
      starts: 0,
      completed: 0,
    });
    expect(result.days[0]).toMatchObject({ hasRecords: true, playedMs: 86400000 });
    expect(result.outputs[0]).toMatchObject({ id: 10, playedMs: 86400000, successfulMs: 86400000 });
    const history = await aggregatePlaybackHistory(events, { ...dayQuery, mediaId: 'md5-a' }, now);
    expect(history.total).toBe(1);
    expect(history.entries[0]).toMatchObject({ playedMs: 86400000, successfulMs: 86400000 });
    const fallback = await aggregatePlaybackStatistics(
      [
        {
          ...events[1],
          startedAt: events[0].timestamp,
        },
      ],
      dayQuery,
      now,
    );
    expect(fallback.totals.playedMs).toBe(86400000);
    expect(fallback.available?.from).toBe(events[0].timestamp);
    expect(fallback.outputs).toHaveLength(1);
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

  it('clips wall duration to a full local day across a daylight saving transition', async () => {
    process.env.TZ = 'America/New_York';
    const id = randomUUID();
    const events = [
      event(id, 'started', '2026-10-31T23:00:00.000Z'),
      event(id, 'completed', '2026-11-03T01:00:00.000Z'),
    ];
    const dstNow = new Date('2026-11-03T12:00:00.000Z');
    const dstQuery = { playerId: 1, from: '2026-11-01', to: '2026-11-01' };
    const result = await aggregatePlaybackStatistics(events, dstQuery, dstNow);
    expect(result.days[0]).toMatchObject({
      date: '2026-11-01',
      hasRecords: true,
      playedMs: 25 * 3600000,
      successfulMs: 25 * 3600000,
    });
    const history = await aggregatePlaybackHistory(
      events,
      { ...dstQuery, mediaId: 'md5-a' },
      dstNow,
    );
    expect(history.entries[0].playedMs).toBe(25 * 3600000);
  });

  it('paginates details and retains the failed partial airtime outside successful totals', async () => {
    const id = randomUUID();
    const events = [
      ...successful(),
      event(id, 'started', '2026-10-08T11:00:00.000Z'),
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
    expect(history.entries[0].events.map(entry => entry.event)).toEqual([
      'started',
      'error',
      'skipped',
    ]);
    await expect(
      aggregatePlaybackHistory(events, { ...query, mediaId: 'md5-a', limit: 101 }, now),
    ).rejects.toThrow('Invalid history');
  });
});
