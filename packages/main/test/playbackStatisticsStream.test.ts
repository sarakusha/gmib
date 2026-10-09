import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import type { PlaybackStatisticsEvent } from '/@common/playback';
import {
  aggregatePlaybackHistory,
  aggregatePlaybackStatistics,
  PlaybackStatisticsReader,
} from '../src/playbackStatistics';

const originalTZ = process.env.TZ;
process.env.TZ = 'UTC';
const directories: string[] = [];
const query = { playerId: 1, from: '2020-10-01', to: '2020-10-31' };
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
  mediaId: 'clip',
  filename: 'clip.mp4',
  attempt: 1,
  ...(kind === 'error' ? { error: 'Decode failure' } : {}),
  ...extra,
});
const progress = (id: string, start: string, end: string, playedMs?: number) =>
  event(id, 'progress', end, {
    segmentStartedAt: start,
    playedMs: playedMs ?? Date.parse(end) - Date.parse(start),
  });
const successful = (start: string, end: string, playedMs?: number) => {
  const id = randomUUID();
  return [
    event(id, 'started', start),
    progress(id, start, end, playedMs),
    event(id, 'completed', end),
  ];
};
const makeReader = async (events: PlaybackStatisticsEvent[]) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-statistics-stream-'));
  directories.push(directory);
  const groups = new Map<string, PlaybackStatisticsEvent[]>();
  for (const record of events) {
    const day = record.timestamp.slice(0, 10);
    const records = groups.get(day) ?? [];
    records.push(record);
    groups.set(day, records);
  }
  for (const [day, records] of groups)
    await fs.writeFile(
      path.join(directory, `playback-${day}.jsonl`),
      records.map(record => JSON.stringify(record)).join('\n') + '\n',
    );
  return { directory, reader: new PlaybackStatisticsReader(directory) };
};
const comparable = ({
  generatedAt: _now,
  ...value
}: Awaited<ReturnType<PlaybackStatisticsReader['statistics']>>) => value;
afterEach(async () => {
  process.env.TZ = 'UTC';
  await Promise.all(
    directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('bounded streaming playback statistics', () => {
  it('matches the reference across midnight, pauses, overlap, errors and completion after the selected end', async () => {
    const long = randomUUID();
    const failed = randomUUID();
    const events = [
      ...successful('2020-10-01T10:00:00.000Z', '2020-10-01T10:00:01.000Z', 999.6),
      ...successful('2020-10-02T10:00:00.000Z', '2020-10-02T10:00:01.000Z', 999.6),
      event(long, 'started', '2020-10-07T23:59:55.000Z'),
      progress(long, '2020-10-07T23:59:55.000Z', '2020-10-08T00:00:05.000Z'),
      event(long, 'paused', '2020-10-08T00:00:05.000Z'),
      event(failed, 'started', '2020-10-08T23:59:50.000Z'),
      progress(failed, '2020-10-08T23:59:50.000Z', '2020-10-08T23:59:59.999Z'),
      event(failed, 'error', '2020-10-08T23:59:59.999Z'),
      event(failed, 'skipped', '2020-10-09T00:00:00.002Z'),
      event(long, 'resumed', '2020-10-09T11:00:00.000Z'),
      event(long, 'paused', '2020-10-09T11:00:00.001Z'),
      event(long, 'resumed', '2020-10-10T10:00:00.000Z'),
      progress(long, '2020-10-10T10:00:00.000Z', '2020-10-10T10:00:05.000Z'),
      progress(long, '2020-10-10T10:00:00.000Z', '2020-10-10T10:00:05.000Z'),
      event(long, 'completed', '2020-10-10T10:00:05.000Z'),
      event(randomUUID(), 'started', '2020-10-03T01:00:00.000Z', { playerId: 2 }),
    ];
    const { reader } = await makeReader(events);
    for (const selected of [
      query,
      { ...query, from: '2020-10-08', to: '2020-10-08' },
      { ...query, from: '2020-10-09', to: '2020-10-09' },
    ]) {
      const actual = await reader.statistics(selected);
      const expected = await aggregatePlaybackStatistics(events, selected);
      expect(comparable(actual)).toEqual(comparable(expected));
      const historyQuery = { ...selected, mediaId: 'clip' };
      expect(await reader.history(historyQuery)).toEqual(
        await aggregatePlaybackHistory(events, historyQuery),
      );
    }
  });

  it('retains a paused-only day as history and never marks it as a gap', async () => {
    const id = randomUUID();
    const events = [
      event(id, 'started', '2020-10-07T10:00:00.000Z'),
      progress(id, '2020-10-07T10:00:00.000Z', '2020-10-07T10:00:02.000Z'),
      event(id, 'paused', '2020-10-08T00:00:00.000Z'),
      event(id, 'resumed', '2020-10-09T10:00:00.000Z'),
      progress(id, '2020-10-09T10:00:00.000Z', '2020-10-09T10:00:02.000Z'),
      event(id, 'completed', '2020-10-09T10:00:02.000Z'),
    ];
    const { reader } = await makeReader(events);
    const selected = { ...query, from: '2020-10-08', to: '2020-10-08' };
    expect(comparable(await reader.statistics(selected))).toEqual(
      comparable(await aggregatePlaybackStatistics(events, selected)),
    );
    expect((await reader.statistics(selected)).days[0].hasRecords).toBe(true);
    expect(await reader.history({ ...selected, mediaId: 'clip' })).toEqual(
      await aggregatePlaybackHistory(events, { ...selected, mediaId: 'clip' }),
    );
  });

  it('deduplicates raw and gzip copies, accepts maximally escaped valid errors, and skips huge malformed lines', async () => {
    const errors = event(randomUUID(), 'error', '2020-10-08T11:00:00.000Z', {
      error: '\n'.repeat(16_384),
      filename: 'ю'.repeat(4096),
    });
    const events = [...successful('2020-10-08T10:00:00.000Z', '2020-10-08T10:00:10.000Z'), errors];
    const { reader, directory } = await makeReader(events);
    const file = path.join(directory, 'playback-2020-10-08.jsonl');
    await fs.writeFile(`${file}.gz`, gzipSync(await fs.readFile(file)));
    await fs.appendFile(file, 'x'.repeat(1024 * 1024) + '\n{"broken":');
    const actual = await reader.statistics(query);
    expect(actual.totals.completed).toBe(1);
    expect(actual.totals.errors).toBe(1);
    expect(actual.quality.invalidRecords).toBe(2);
    expect((await reader.history({ ...query, mediaId: 'clip' })).total).toBe(2);
  });

  it('streams many days and paginates history without retaining unrelated players', async () => {
    const events: PlaybackStatisticsEvent[] = [];
    for (let day = 1; day <= 31; day += 1) {
      for (let slot = 0; slot < 300; slot += 1) {
        const start = new Date(Date.UTC(2020, 9, day, 0, 0, slot * 10));
        const end = new Date(start.getTime() + 10_000);
        events.push(...successful(start.toISOString(), end.toISOString()));
      }
    }
    const { reader } = await makeReader(events);
    expect(comparable(await reader.statistics(query))).toEqual(
      comparable(await aggregatePlaybackStatistics(events, query)),
    );
    const historyQuery = { ...query, mediaId: 'clip', offset: 1000, limit: 20 };
    expect(await reader.history(historyQuery)).toEqual(
      await aggregatePlaybackHistory(events, historyQuery),
    );
    await expect(reader.history({ ...historyQuery, offset: 10_001 })).rejects.toThrow(
      'Invalid history',
    );
  }, 20_000);

  it('compacts long in-day progress without losing pauses or a non-UTC calendar boundary', async () => {
    process.env.TZ = 'Asia/Kathmandu';
    const id = randomUUID();
    let cursor = Date.parse('2020-10-08T18:00:00.000Z');
    const events = [event(id, 'started', new Date(cursor).toISOString())];
    for (let i = 0; i < 500; i += 1) {
      events.push(
        progress(
          id,
          new Date(cursor).toISOString(),
          new Date(cursor + 15_000).toISOString(),
          14_999.6,
        ),
      );
      cursor += 15_000;
      if (i % 10 === 0) {
        events.push(event(id, 'paused', new Date(cursor).toISOString()));
        cursor += 60_000;
        events.push(event(id, 'resumed', new Date(cursor).toISOString()));
      }
    }
    events.push(event(id, 'completed', new Date(cursor).toISOString()));
    const { reader } = await makeReader(events);
    for (const selected of [query, { ...query, from: '2020-10-09', to: '2020-10-09' }]) {
      expect(comparable(await reader.statistics(selected))).toEqual(
        comparable(await aggregatePlaybackStatistics(events, selected)),
      );
      expect(await reader.history({ ...selected, mediaId: 'clip' })).toEqual(
        await aggregatePlaybackHistory(events, { ...selected, mediaId: 'clip' }),
      );
    }
  });

  it('evicts old orphan starts instead of a recent cross-midnight playback', async () => {
    const events = Array.from({ length: 1025 }, (_, index) =>
      event(randomUUID(), 'started', new Date(Date.UTC(2020, 9, 7, 0, 0, index)).toISOString()),
    );
    const id = randomUUID();
    events.push(
      event(id, 'started', '2020-10-08T23:59:55.000Z'),
      progress(id, '2020-10-08T23:59:55.000Z', '2020-10-08T23:59:58.000Z'),
      progress(id, '2020-10-08T23:59:58.000Z', '2020-10-09T00:00:05.000Z'),
      event(id, 'completed', '2020-10-09T00:00:05.000Z'),
    );
    const { reader } = await makeReader(events);
    const result = await reader.statistics(query);
    expect(comparable(result)).toEqual(
      comparable(await aggregatePlaybackStatistics(events, query)),
    );
    expect(result.totals.successfulMs).toBe(10000);
    expect(result.quality.incompleteAttempts).toBe(1025);
    const history = await reader.history({ ...query, mediaId: 'clip', limit: 1 });
    expect(history.total).toBe(1026);
    expect(history.entries[0]).toMatchObject({
      playbackId: id,
      playedMs: 10000,
      outcome: 'completed',
    });
  });

  it('limits very long detail timelines explicitly while preserving their counted duration', async () => {
    const id = randomUUID();
    const events = [event(id, 'started', '2020-10-08T10:00:00.000Z')];
    for (let i = 1; i <= 1100; i += 1)
      events.push(
        event(
          id,
          i % 2 ? 'paused' : 'resumed',
          new Date(Date.UTC(2020, 9, 8, 10, 0, i)).toISOString(),
        ),
      );
    events.push(progress(id, '2020-10-08T10:20:00.000Z', '2020-10-08T10:20:05.000Z'));
    events.push(event(id, 'completed', '2020-10-08T10:20:05.000Z'));
    const { reader } = await makeReader(events);
    const result = await reader.history({ ...query, mediaId: 'clip' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].playedMs).toBe(5000);
    expect(result.entries[0].events).toHaveLength(1001);
    expect(result.entries[0].events[0]).toMatchObject({ event: 'details-truncated' });
  });
});
