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
  it('includes paused/seek wall time and preserves interruption and incomplete outcomes', async () => {
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
  it('clips cross-midnight attempts and ignores overlapping legacy progress', async () => {
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
    expect((await reader.statistics(query)).totals.playedMs).toBe(10000);
  });
  it('does not duplicate an event or infer completion after a restart', async () => {
    const records = successful();
    await append(records.slice(0, 2));
    await store.append(records[1]);
    expect((await reader.statistics(query)).totals).toMatchObject({
      completed: 0,
      playedMs: 0,
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
  it('retains the history total for a page beyond the last entry', async () => {
    await append(successful());
    expect(await reader.history({ ...query, mediaId: 'clip', offset: 10 })).toEqual({
      entries: [],
      total: 1,
      offset: 10,
      limit: 50,
    });
    expect(await reader.history({ ...query, mediaId: 'absent' })).toEqual({
      entries: [],
      total: 0,
      offset: 0,
      limit: 50,
    });
  });

  it('uses the latest filename once per media with deterministic equal-time ties', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
    await append([
      event(ids[0], 'started', '2026-10-08T10:00:00.000Z', { filename: 'old.mp4' }),
      event(ids[1], 'started', '2026-10-08T11:00:00.000Z', { filename: 'new.mp4' }),
      event(ids[2], 'started', '2026-10-08T11:00:00.000Z', { filename: 'latest.mp4' }),
    ]);
    expect((await reader.statistics(query)).rows[0]).toMatchObject({
      mediaId: 'clip',
      filename: 'latest.mp4',
      starts: 3,
    });
  });

  it('aggregates thousands of distinct media in two reads and reuses the report facts', async () => {
    // Bulk seed realistic cardinality without timing thousands of individual writer transactions.
    const count = 6000;
    const start = Date.parse('2026-10-08T10:00:00.000Z');
    await store.write(async sql => {
      await sql.exec(`CREATE TEMP TABLE fixture AS WITH RECURSIVE numbers(n) AS (
        VALUES(1) UNION ALL SELECT n+1 FROM numbers WHERE n<${count}
      ) SELECT CAST(n AS TEXT) AS id,${start}+n*1000 AS at FROM numbers;
      INSERT INTO attempts(id,player_id,media_id,attempt,filename,filename_at,first_at,last_at,
        started_at,completed_at,terminal,terminal_at,completed_status)
      SELECT id,1,id,1,id||'.mp4',at+1000,at,at+1000,at,at+1000,'completed',at+1000,'confirmed' FROM fixture;
      INSERT INTO events(id,attempt_id,at,type)
      SELECT id||'-start',id,at,'started' FROM fixture UNION ALL
      SELECT id||'-end',id,at+1000,'completed' FROM fixture;
      INSERT INTO segments(id,attempt_id,start_at,end_at,played_ms,all_showing)
      SELECT id,id,at,at+1000,1000,1 FROM fixture;
      DROP TABLE fixture;`);
    });
    const statements: string[] = [];
    let reportPlan: { detail: string }[] = [];
    let historyStatement = '';
    let historyParams: (string | number | null)[] = [];
    reader = new PlaybackStatisticsSqlReader(
      {
        read: callback =>
          store.read(sql =>
            callback({
              ...sql,
              get: (statement, params) => {
                statements.push(statement);
                return sql.get(statement, params);
              },
              all: async (statement, params) => {
                statements.push(statement);
                if (statement.includes('SELECT totals.count,page.*')) {
                  historyStatement = statement;
                  historyParams = params ?? [];
                }
                reportPlan = await sql.all('EXPLAIN QUERY PLAN ' + statement, params);
                return sql.all(statement, params);
              },
            }),
          ),
      },
      () => now,
    );
    const result = await reader.statistics(query);
    expect(statements).toHaveLength(2);
    expect(result.rows).toHaveLength(count);
    expect(result.totals).toMatchObject({
      starts: count,
      completed: count,
      confirmed: count,
      playedMs: count * 1000,
      successfulMs: count * 1000,
    });
    expect(result.days[0]).toMatchObject({ starts: count, playedMs: count * 1000 });
    expect(reportPlan.filter(row => row.detail === 'MATERIALIZE attempt_metrics')).toHaveLength(1);
    statements.length = 0;
    const history = await reader.history({ ...query, mediaId: '1' });
    expect(statements).toHaveLength(3);
    expect(history.total).toBe(1);
    expect(history.entries[0]).toMatchObject({ mediaId: '1', playedMs: 1000, successfulMs: 1000 });
    // Много попыток одного ролика: total остаётся полным, но длительности
    // вычисляются только для попыток двадцатистрочной страницы.
    await store.write(sql => sql.run("UPDATE attempts SET media_id='same-media'"));
    const many = await reader.history({ ...query, mediaId: 'same-media', limit: 20, offset: 25 });
    expect(many.total).toBe(count);
    expect(many.entries).toHaveLength(20);
    expect(many.entries.every(entry => entry.playedMs === 1000)).toBe(true);
    const cte = historyStatement.slice(0, historyStatement.indexOf('SELECT totals.count,page.*'));
    expect(
      await store.read(sql =>
        sql.get(cte + 'SELECT COUNT(*) AS count FROM scoped_intervals', historyParams),
      ),
    ).toEqual({ count: 20 });
  });

  it('uses the current host timezone when reporting intervals across midnight', async () => {
    const records = successful('2026-10-07T23:59:55.000Z', '2026-10-08T00:00:05.000Z');
    await append(records);
    expect(await reader.statistics(query)).toEqual(
      await aggregatePlaybackStatistics(records, query, now),
    );
    process.env.TZ = 'America/New_York';
    expect(await reader.statistics(query)).toEqual(
      await aggregatePlaybackStatistics(records, query, now),
    );
  });

  it('keeps zero-duration and diagnostic-only days distinct from gaps in reports', async () => {
    const id = randomUUID();
    await parity([
      event(id, 'paused', '2026-10-05T10:00:00.000Z'),
      event(id, 'progress', '2026-10-07T10:00:10.000Z', {
        segmentStartedAt: '2026-10-07T10:00:00.000Z',
        playedMs: 0,
      }),
      event(id, 'completed', '2026-10-08T10:00:00.000Z'),
    ]);
    const report = await reader.statistics(query);
    expect(report.days.map(day => [day.date, day.hasRecords, day.playedMs])).toEqual([
      ['2026-10-05', true, 0],
      ['2026-10-06', false, 0],
      ['2026-10-07', true, 0],
      ['2026-10-08', true, 0],
    ]);
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

describe('wall-clock duration without progress', () => {
  it('counts pause time, ignores arbitrary legacy frame credit and requires full confirmation', async () => {
    const id = randomUUID();
    await append([
      event(id, 'started', '2026-10-08T10:00:00.000Z'),
      event(id, 'paused', '2026-10-08T10:00:01.000Z'),
      event(id, 'resumed', '2026-10-08T10:00:04.000Z'),
      event(id, 'progress', '2026-10-08T10:00:05.000Z', {
        segmentStartedAt: '2026-10-08T10:00:00.000Z',
        playedMs: 123,
      }),
      event(id, 'completed', '2026-10-08T10:00:05.000Z', {
        outputResult: {
          status: 'partial',
          reasons: ['hidden'],
          outputs: [{ ...screen, status: 'confirmed', reasons: [] }],
        },
      }),
    ]);
    const result = await reader.statistics(query);
    expect(result.durationBasis).toBe('wall-clock');
    expect(result.totals).toMatchObject({ playedMs: 5000, successfulMs: 0, partial: 1 });
    expect(result.outputs[0]).toMatchObject({ playedMs: 5000, successfulMs: 5000 });
    expect((await reader.history({ ...query, mediaId: 'clip' })).entries[0]).toMatchObject({
      playedMs: 5000,
      successfulMs: 0,
    });
  });

  it('finds a completed wall interval and its outputs on a day without events', async () => {
    const id = randomUUID();
    const records = [
      event(id, 'started', '2026-10-07T23:00:00.000Z'),
      event(id, 'completed', '2026-10-09T01:00:00.000Z'),
    ];
    const part = { ...query, from: '2026-10-08', to: '2026-10-08' };
    await parity(records, part);
    const result = await reader.statistics(part);
    expect(result.totals).toMatchObject({
      starts: 0,
      completed: 0,
      playedMs: 86400000,
      successfulMs: 86400000,
    });
    expect(result.days[0]).toMatchObject({ hasRecords: true, playedMs: 86400000 });
    expect(result.outputs).toHaveLength(1);
  });

  it('reconstructs a retained interval from terminal startedAt and clips it again during cleanup', async () => {
    await store.close();
    let retention = 2;
    store = new PlaybackStatisticsStore(':memory:', {
      now: () => now,
      retentionDays: () => retention,
    });
    reader = new PlaybackStatisticsSqlReader(store, () => now);
    const startedAt = '2026-10-07T23:59:55.000Z';
    await append([event(randomUUID(), 'completed', '2026-10-09T00:00:05.000Z', { startedAt })]);
    let result = await reader.statistics(query);
    expect(result.available?.from).toBe('2026-10-08T00:00:00.000Z');
    expect(result.totals).toMatchObject({ playedMs: 86405000, successfulMs: 86405000 });
    expect(result.quality.incompleteAttempts).toBe(0);
    retention = 1;
    await store.cleanup();
    result = await reader.statistics(query);
    expect(result.available?.from).toBe('2026-10-09T00:00:00.000Z');
    expect(result.totals).toMatchObject({ playedMs: 5000, successfulMs: 5000 });
    const history = await reader.history({ ...query, mediaId: 'clip' });
    expect(history.entries[0]).toMatchObject({ startedAt, playedMs: 5000, successfulMs: 5000 });
    expect(history.entries[0].events.map(e => e.event)).toEqual(['completed']);
  });

  it('does not invent time for pending or reversed attempts and ends interrupted attempts at their outcome', async () => {
    const pending = randomUUID(),
      reversed = randomUUID(),
      interrupted = randomUUID();
    await parity([
      event(pending, 'started', '2026-10-08T10:00:00.000Z'),
      event(reversed, 'completed', '2026-10-08T11:00:00.000Z', {
        startedAt: '2026-10-08T11:00:01.000Z',
      }),
      event(interrupted, 'started', '2026-10-08T12:00:00.000Z'),
      event(interrupted, 'interrupted', '2026-10-08T12:00:03.000Z'),
      event(interrupted, 'completed', '2026-10-08T12:00:10.000Z'),
    ]);
    expect((await reader.statistics(query)).totals).toMatchObject({
      playedMs: 3000,
      successfulMs: 0,
    });
    expect((await reader.statistics(query)).quality.incompleteAttempts).toBe(2);
  });
});

it('keeps reconstructed wall coverage when later facts become future after clock rollback', async () => {
  const id = randomUUID();
  await append([
    event(id, 'completed', '2026-10-08T10:00:00.000Z', { startedAt: '2026-10-08T09:00:00.000Z' }),
    event(randomUUID(), 'started', '2026-10-08T11:00:00.000Z'),
  ]);
  reader = new PlaybackStatisticsSqlReader(store, () => new Date('2026-10-08T10:30:00.000Z'));
  const report = await reader.statistics(query);
  expect(report.available?.from).toBe('2026-10-08T09:00:00.000Z');
  expect(report.totals).toMatchObject({ playedMs: 3600000, successfulMs: 3600000 });
  expect((await reader.history({ ...query, mediaId: 'clip' })).entries[0].playedMs).toBe(3600000);
});

it('keeps an output breakdown for a declared interval with only a later terminal snapshot', async () => {
  const record = event(randomUUID(), 'completed', '2026-10-09T01:00:00.000Z', {
    startedAt: '2026-10-07T23:00:00.000Z',
  });
  const part = { ...query, from: '2026-10-08', to: '2026-10-08' };
  await parity([record], part);
  const report = await reader.statistics(part);
  expect(report.outputs).toHaveLength(1);
  expect(report.outputs[0]).toMatchObject({
    id: screen.id,
    playedMs: 86400000,
    successfulMs: 86400000,
  });
});
