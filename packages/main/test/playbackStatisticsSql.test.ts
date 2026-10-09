import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';
import { aggregatePlaybackHistory, aggregatePlaybackStatistics } from '../src/playbackStatistics';
import { PlaybackStatisticsSqlReader } from '../src/playbackStatisticsSql';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

const originalTZ = process.env.TZ;
const now = new Date('2026-10-09T18:00:00.000Z');
const query = { playerId: 1, from: '2026-10-01', to: '2026-10-09' };
const screen: PlaybackOutputSnapshot = {
  id: 10,
  name: 'Основной дисплей',
  display: -1,
  resolvedDisplayId: 16095738401594692,
  state: 'showing',
};
const event = (
  id: string,
  kind: PlaybackStatisticsEvent['event'],
  at: string,
  extra: Partial<PlaybackStatisticsEvent> = {},
): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId: id,
  playerId: 1,
  mediaId: 'clip',
  filename: 'clip.mp4',
  attempt: 1,
  event: kind,
  timestamp: at,
  output: { outputs: [screen] },
  ...(kind === 'completed'
    ? {
        outputResult: {
          status: 'confirmed' as const,
          reasons: [],
          outputs: [{ ...screen, status: 'confirmed' as const, reasons: [] }],
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
let store: PlaybackStatisticsStore;
let reader: PlaybackStatisticsSqlReader;
beforeEach(() => {
  process.env.TZ = 'UTC';
  store = new PlaybackStatisticsStore(':memory:', { now: () => now });
  reader = new PlaybackStatisticsSqlReader(store, () => now);
});
afterEach(async () => {
  await store.close();
  process.env.TZ = 'UTC';
});
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const append = async (events: PlaybackStatisticsEvent[]) => {
  for (const record of events) await store.append(record);
};
const parity = async (events: PlaybackStatisticsEvent[], part = query) => {
  await append(events);
  expect(await reader.statistics(part)).toEqual(
    await aggregatePlaybackStatistics(events, part, now),
  );
  expect(await reader.history({ ...part, mediaId: 'clip' })).toEqual(
    await aggregatePlaybackHistory(events, { ...part, mediaId: 'clip' }, now),
  );
};

describe('SQLite playback reports', () => {
  it('matches canonical empty coverage and validates requests before reading', async () => {
    await parity([]);
    await expect(reader.statistics({ ...query, from: '2026-02-30' })).rejects.toThrow(
      'Invalid calendar date',
    );
    await expect(reader.history({ ...query, mediaId: 'clip', limit: 101 })).rejects.toThrow(
      'Invalid history pagination',
    );
  });
  it('matches completed and failed playback, independent errors/skips and native display IDs', async () => {
    const failed = randomUUID();
    await parity([
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
    ]);
    expect((await reader.statistics(query)).outputs[0].resolvedDisplayId).toBe(
      screen.resolvedDisplayId,
    );
  });
  it('preserves paused/seek gaps, interruptions and pending/no-progress quality', async () => {
    const id = randomUUID();
    await parity([
      event(id, 'started', '2026-10-08T10:00:00.000Z'),
      event(id, 'progress', '2026-10-08T10:00:03.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 3000,
      }),
      event(id, 'paused', '2026-10-08T10:00:03.000Z'),
      event(id, 'resumed', '2026-10-08T10:05:00.000Z'),
      event(id, 'seeked', '2026-10-08T10:05:01.000Z', { position: 50, previousPosition: 3 }),
      event(id, 'progress', '2026-10-08T10:05:02.000Z', {
        segmentStartedAt: '2026-10-08T10:05:00.000Z',
        playedMs: 2000,
      }),
      event(id, 'completed', '2026-10-08T10:05:02.000Z'),
      event(randomUUID(), 'interrupted', '2026-10-08T10:06:00.000Z', { reason: 'manual-next' }),
      event(randomUUID(), 'started', '2026-10-08T10:07:00.000Z'),
      event(randomUUID(), 'completed', '2026-10-08T10:08:00.000Z'),
    ]);
  });
  it('clips cross-midnight progress to days and credits overlaps only once', async () => {
    const records = successful('2026-10-07T23:59:55.000Z', '2026-10-08T00:00:05.000Z');
    records.splice(
      2,
      0,
      event(records[0].playbackId, 'progress', '2026-10-08T00:00:08.000Z', {
        segmentStartedAt: '2026-10-08T00:00:00.000Z',
        playedMs: 8000,
      }),
    );
    await parity(records, { ...query, from: '2026-10-08', to: '2026-10-08' });
    expect((await reader.statistics(query)).totals.playedMs).toBe(13000);
  });
  it('does not duplicate an event or infer completion after a restart', async () => {
    const records = successful();
    await append(records.slice(0, 2));
    await store.append(records[1]);
    expect((await reader.statistics(query)).totals).toMatchObject({
      completed: 0,
      playedMs: 10000,
      successfulMs: 0,
    });
    await store.append(records[2]);
    expect(await reader.statistics(query)).toEqual(
      await aggregatePlaybackStatistics(records, query, now),
    );
  });
  it('returns all output breakdowns and scoped history with changing output health', async () => {
    const id = randomUUID();
    const second = {
      ...screen,
      id: 20,
      name: 'Второй дисплей',
      display: 2,
      state: 'hidden' as const,
    };
    const partial = {
      status: 'partial' as const,
      reasons: ['hidden' as const],
      outputs: [
        { ...screen, status: 'confirmed' as const, reasons: [] },
        { ...second, status: 'unconfirmed' as const, reasons: ['hidden' as const] },
      ],
    };
    const records = [
      event(id, 'started', '2026-10-08T10:00:00.000Z', { output: { outputs: [screen, second] } }),
      event(id, 'progress', '2026-10-08T10:00:10.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 10000,
        output: { outputs: [screen, second] },
      }),
      event(id, 'completed', '2026-10-08T10:00:10.000Z', {
        output: { outputs: [screen, second] },
        outputResult: partial,
      }),
    ];
    await parity(records);
    for (const outputId of [10, 20, 999]) {
      expect(await reader.statistics({ ...query, outputId })).toEqual(
        await aggregatePlaybackStatistics(records, { ...query, outputId }, now),
      );
      expect(await reader.history({ ...query, mediaId: 'clip', outputId })).toEqual(
        await aggregatePlaybackHistory(records, { ...query, mediaId: 'clip', outputId }, now),
      );
    }
  });
  it('counts a repeated metric only once in each selected period', async () => {
    const records = successful();
    records.push({ ...records[2], eventId: randomUUID(), timestamp: '2026-10-09T10:00:00.000Z' });
    await parity(records, { ...query, from: '2026-10-09', to: '2026-10-09' });
    expect((await reader.statistics(query)).totals.completed).toBe(1);
  });
  it('does not invent observed time or success after the clock moves backwards', async () => {
    const records = successful();
    await append(records);
    const rewound = new Date('2026-10-08T10:00:05.000Z');
    reader = new PlaybackStatisticsSqlReader(store, () => rewound);
    expect(await reader.statistics(query)).toEqual(
      await aggregatePlaybackStatistics(records, query, rewound),
    );
    expect(await reader.history({ ...query, mediaId: 'clip' })).toEqual(
      await aggregatePlaybackHistory(records, { ...query, mediaId: 'clip' }, rewound),
    );
  });
  it('preserves an unresolved terminal display when a later observation resolves it', async () => {
    const id = randomUUID();
    const missing: PlaybackOutputSnapshot = {
      id: 10,
      name: 'Недоступный дисплей',
      state: 'unavailable',
    };
    const records = [
      event(id, 'started', '2026-10-08T10:00:00.000Z', { output: { outputs: [missing] } }),
      event(id, 'progress', '2026-10-08T10:00:01.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 1000,
        output: { outputs: [missing] },
      }),
      event(id, 'completed', '2026-10-08T10:00:01.000Z', {
        output: { outputs: [missing] },
        outputResult: {
          status: 'unconfirmed',
          reasons: ['unavailable'],
          outputs: [{ ...missing, status: 'unconfirmed', reasons: ['unavailable'] }],
        },
      }),
      event(id, 'output-changed', '2026-10-08T10:00:02.000Z'),
    ];
    await parity(records);
    const history = await reader.history({ ...query, mediaId: 'clip' });
    expect(history.entries[0].outputResult?.outputs[0].resolvedDisplayId).toBeUndefined();
  });
  it('clips a progress segment to retention without requiring an expired started record', async () => {
    await store.close();
    store = new PlaybackStatisticsStore(':memory:', { now: () => now, retentionDays: () => 2 });
    reader = new PlaybackStatisticsSqlReader(store, () => now);
    const records = successful('2026-10-07T23:59:55.000Z', '2026-10-08T00:00:05.000Z');
    await append(records);
    const retained = [
      { ...records[1], segmentStartedAt: '2026-10-08T00:00:00.000Z', playedMs: 5000 },
      records[2],
    ];
    expect(await reader.statistics(query)).toEqual(
      await aggregatePlaybackStatistics(retained, query, now),
    );
    expect(await reader.history({ ...query, mediaId: 'clip' })).toEqual(
      await aggregatePlaybackHistory(retained, { ...query, mediaId: 'clip' }, now),
    );
  });
  it('paginates histories and limits event details inside SQLite', async () => {
    const records = [
      ...successful(),
      ...successful('2026-10-08T12:00:00.000Z', '2026-10-08T12:00:01.000Z'),
    ];
    const id = records[3].playbackId;
    for (let index = 0; index < 1005; index++)
      records.push(
        event(id, 'paused', new Date(Date.parse('2026-10-08T12:00:02.000Z') + index).toISOString()),
      );
    await append(records);
    const latest = await reader.history({ ...query, mediaId: 'clip', limit: 1 });
    expect(latest.total).toBe(2);
    expect(latest.entries[0].playbackId).toBe(id);
    expect(latest.entries[0].events).toHaveLength(1001);
    expect(latest.entries[0].events[0]).toMatchObject({
      event: 'details-truncated',
      reason: 'Показаны последние 1000 событий; более ранних событий: 7.',
    });
    const older = await reader.history({ ...query, mediaId: 'clip', offset: 1, limit: 1 });
    expect(older.entries[0].playbackId).toBe(records[0].playbackId);
  });
  it('uses the host calendar for a DST day instead of fixed 24-hour buckets', async () => {
    process.env.TZ = 'Europe/Berlin';
    const dstNow = new Date('2026-10-26T18:00:00.000Z');
    await store.close();
    store = new PlaybackStatisticsStore(':memory:', { now: () => dstNow });
    reader = new PlaybackStatisticsSqlReader(store, () => dstNow);
    const records = successful('2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z');
    await append(records);
    const part = { playerId: 1, from: '2026-10-25', to: '2026-10-25' };
    expect(await reader.statistics(part)).toEqual(
      await aggregatePlaybackStatistics(records, part, dstNow),
    );
    expect((await reader.statistics(part)).totals.playedMs).toBe(25 * 60 * 60 * 1000);
  });
});
