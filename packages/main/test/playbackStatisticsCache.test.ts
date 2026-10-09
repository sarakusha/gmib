import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackStatisticsEvent } from '/@common/playback';
import { PlaybackStatisticsReader } from '../src/playbackStatistics';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) };
});

const directories: string[] = [];
const query = { playerId: 1, from: '2020-10-01', to: '2020-10-31' };
const legacy = `${JSON.stringify({ event: 'started', timestamp: '2020-10-08T10:00:00Z' })}\n`;
const makeReader = async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-statistics-cache-'));
  directories.push(directory);
  return { directory, reader: new PlaybackStatisticsReader(directory) };
};
const completed = (playerId = 1): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId: randomUUID(),
  event: 'completed',
  timestamp: '2020-10-08T10:00:00.000Z',
  playerId,
  mediaId: 'clip',
  filename: 'clip.mp4',
  attempt: 1,
});
const jsonLine = (value: unknown) => `${JSON.stringify(value)}\n`;
afterEach(async () => {
  vi.mocked(createReadStream).mockClear();
  await Promise.all(
    directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('playback statistics legacy file cache', () => {
  it('reuses unchanged raw and compressed legacy files across periods and history without losing quality counts', async () => {
    const { reader, directory } = await makeReader();
    await fs.writeFile(path.join(directory, 'playback-2020-10-07.jsonl'), legacy.repeat(1000));
    await fs.writeFile(
      path.join(directory, 'playback-2020-10-08.jsonl.gz'),
      gzipSync(legacy + jsonLine({ version: 3, event: 'completed' }) + 'broken\n'),
    );
    const first = await reader.statistics(query);
    expect(first.quality).toMatchObject({ ignoredLegacyRecords: 1001, invalidRecords: 2 });
    expect(first.available).toBeNull();
    expect(createReadStream).toHaveBeenCalledTimes(2);
    const second = await reader.statistics({ ...query, from: '2020-10-08', to: '2020-10-08' });
    expect(second.quality).toEqual(first.quality);
    expect(await reader.history({ ...query, mediaId: 'clip' })).toMatchObject({ total: 0 });
    expect(createReadStream).toHaveBeenCalledTimes(2);
  });

  it('detects append, truncation and deletion without retaining stale coverage or quality', async () => {
    const { reader, directory } = await makeReader();
    const file = path.join(directory, 'playback-2020-10-08.jsonl');
    await fs.writeFile(file, legacy);
    await reader.statistics(query);
    await fs.appendFile(file, jsonLine(completed()));
    const appended = await reader.statistics(query);
    expect(appended.totals.completed).toBe(1);
    expect(appended.available).not.toBeNull();
    expect(appended.quality.ignoredLegacyRecords).toBe(1);
    await fs.writeFile(file, '');
    const truncated = await reader.statistics(query);
    expect(truncated.available).toBeNull();
    expect(truncated.quality.ignoredLegacyRecords).toBe(0);
    await fs.rm(file);
    expect((await reader.statistics(query)).quality.unreadableFiles).toBe(0);
    await fs.writeFile(file, jsonLine(completed()));
    expect((await reader.statistics(query)).totals.completed).toBe(1);
  });

  it('detects a same-size rewrite even if the modification time is restored', async () => {
    const { reader, directory } = await makeReader();
    const file = path.join(directory, 'playback-2020-10-08.jsonl');
    const record = jsonLine(completed());
    await fs.writeFile(file, legacy.padEnd(record.length, ' '));
    const previous = await fs.stat(file);
    await reader.statistics(query);
    await fs.writeFile(file, record);
    await fs.utimes(file, previous.atime, previous.mtime);
    expect((await reader.statistics(query)).totals.completed).toBe(1);
  });

  it('does not cache valid events excluded by the current player filter', async () => {
    const { reader, directory } = await makeReader();
    await fs.writeFile(path.join(directory, 'playback-2020-10-08.jsonl'), jsonLine(completed(2)));
    expect((await reader.statistics(query)).available).toBeNull();
    expect((await reader.statistics({ ...query, playerId: 2 })).totals.completed).toBe(1);
    expect(createReadStream).toHaveBeenCalledTimes(2);
  });

  it('retries damaged gzip files and retains counters from their readable prefix', async () => {
    const { reader, directory } = await makeReader();
    const file = path.join(directory, 'playback-2020-10-08.jsonl.gz');
    const compressed = gzipSync(legacy.repeat(1000));
    await fs.writeFile(file, compressed.subarray(0, compressed.length - 8));
    const first = await reader.statistics(query);
    const second = await reader.statistics(query);
    expect(first.quality.unreadableFiles).toBe(1);
    expect(second.quality).toEqual(first.quality);
    expect(createReadStream).toHaveBeenCalledTimes(2);
    await fs.writeFile(file, gzipSync(jsonLine(completed())));
    expect((await reader.statistics(query)).totals.completed).toBe(1);
  });
});
