import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackEvent } from '/@common/playback';
import { isPlaybackEvent, isPlaybackEventForPlayer } from '/@common/playback';
import { PlaybackEventLog, playbackLogFilename } from '../src/playbackEventLog';
import { broadcastPlaybackRetry } from '../src/playbackRetry';
import { PlaybackStatusStore } from '../src/playbackStatus';

const temporaryDirectories: string[] = [];

const eventAt = (timestamp: string, event: PlaybackEvent['event'] = 'started'): PlaybackEvent => ({
  event,
  playerId: 1,
  mediaId: 'media-1',
  attempt: 0,
  playbackId: `playback-${timestamp}`,
  timestamp,
  ...(event === 'error' || event === 'quarantined' ? { error: 'decode failed' } : {}),
});

const readRecords = async (directory: string, date = '2026-09-18') =>
  (await fs.readFile(path.join(directory, `playback-${date}.jsonl`), 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);

const temporaryDirectory = async (): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-playback-log-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('PlaybackEventLog', () => {
  it('uses a UTC date in the daily log filename', () => {
    expect(playbackLogFilename(new Date('2026-09-18T23:59:59.999Z'))).toBe(
      'playback-2026-09-18.jsonl',
    );
  });

  it('starts each UTC daily file with a self-contained v2 session and dictionaries', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'session-a',
    });

    await log.append({
      ...eventAt('2026-09-18T10:00:00.000Z'),
      playlistId: 4,
      engine: 'decoder',
      filename: 'clip.mp4',
    });

    expect(await readRecords(directory)).toEqual([
      { event: 'header', version: 2, date: '2026-09-18', timezone: 'UTC' },
      { event: 'session', id: 'session-a' },
      { event: 'context', id: 1, playerId: 1, playlistId: 4, engine: 'decoder' },
      { event: 'media', id: 1, md5: 'media-1', filename: 'clip.mp4' },
      { event: 'started', time: '10:00:00.000', run: 1, context: 1, media: 1 },
    ]);
  });

  it('writes context and media changes once and associates interleaved players by run', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'session-a',
    });
    const first = {
      ...eventAt('2026-09-18T10:00:00.000Z'),
      playlistId: 4,
      engine: 'decoder' as const,
      filename: 'clip.mp4',
      startedAt: '2026-09-18T10:00:00.000Z',
    };
    const second = {
      ...first,
      playerId: 2,
      playlistId: 5,
      timestamp: '2026-09-18T10:00:01.000Z',
    };

    await log.append(first);
    await log.append(second);
    await log.append({ ...first, event: 'completed', timestamp: '2026-09-18T10:00:02.000Z' });
    await log.append({ ...second, event: 'completed', timestamp: '2026-09-18T10:00:03.000Z' });

    const records = await readRecords(directory);
    expect(records.filter(record => record.event === 'media')).toHaveLength(1);
    expect(records.filter(record => record.event === 'context')).toEqual([
      { event: 'context', id: 1, playerId: 1, playlistId: 4, engine: 'decoder' },
      { event: 'context', id: 2, playerId: 2, playlistId: 5, engine: 'decoder' },
    ]);
    expect(records.filter(record => record.event === 'completed')).toEqual([
      { event: 'completed', time: '10:00:02.000', run: 1 },
      { event: 'completed', time: '10:00:03.000', run: 2 },
    ]);
  });

  it('writes a continued record at midnight without counting a second start', async () => {
    const directory = await temporaryDirectory();
    let now = new Date('2026-09-18T23:59:59.000Z');
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => now,
      sessionId: 'session-a',
    });
    const started = {
      ...eventAt('2026-09-18T23:59:58.000Z'),
      startedAt: '2026-09-18T23:59:58.000Z',
    };
    await log.append(started);
    now = new Date('2026-09-19T00:00:01.000Z');
    await log.append({
      ...started,
      event: 'completed',
      timestamp: now.toISOString(),
      playlistId: 99,
      mediaId: 'changed-media',
      filename: 'changed.mp4',
      engine: 'capture',
    });

    expect(await readRecords(directory, '2026-09-19')).toEqual([
      { event: 'header', version: 2, date: '2026-09-19', timezone: 'UTC' },
      { event: 'session', id: 'session-a' },
      { event: 'context', id: 1, playerId: 1 },
      { event: 'media', id: 1, md5: 'media-1' },
      {
        event: 'continued',
        time: '00:00:01.000',
        run: 1,
        context: 1,
        media: 1,
        startedAt: '2026-09-18T23:59:58.000Z',
      },
      { event: 'completed', time: '00:00:01.000', run: 1 },
    ]);
  });

  it('restores a same-day run from startedAt after a logger restart', async () => {
    const directory = await temporaryDirectory();
    const terminal = {
      ...eventAt('2026-09-18T10:05:00.000Z', 'completed'),
      startedAt: '2026-09-18T10:00:00.000Z',
    };
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'restored-session',
    });

    await log.append(terminal);

    expect((await readRecords(directory)).slice(-2)).toEqual([
      {
        event: 'continued',
        time: '10:05:00.000',
        run: 1,
        context: 1,
        media: 1,
        startedAt: '2026-09-18T10:00:00.000Z',
      },
      { event: 'completed', time: '10:05:00.000', run: 1 },
    ]);
  });

  it('makes an error before started independently attributable and collapses quarantine on disk', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'session-a',
    });
    const error = {
      ...eventAt('2026-09-18T10:00:00.000Z', 'error'),
      attempt: 3,
      quarantined: true,
    };
    await log.append(error);
    await log.append({ ...error, event: 'quarantined' });

    expect((await readRecords(directory)).slice(-1)).toEqual([
      {
        event: 'error',
        time: '10:00:00.000',
        run: 1,
        context: 1,
        media: 1,
        attempt: 3,
        error: 'decode failed',
        quarantined: true,
      },
    ]);
  });

  it('appends a parseable v2 session after legacy records and after process restart', async () => {
    const directory = await temporaryDirectory();
    const file = path.join(directory, 'playback-2026-09-18.jsonl');
    await fs.writeFile(file, `${JSON.stringify(eventAt('2026-09-18T09:00:00.000Z'))}\n`);
    for (const sessionId of ['session-a', 'session-b']) {
      const log = new PlaybackEventLog({
        directory,
        retentionDays: () => 7,
        now: () => new Date('2026-09-18T12:00:00.000Z'),
        sessionId,
      });
      await log.append({
        ...eventAt(`2026-09-18T${sessionId === 'session-a' ? '10' : '11'}:00:00.000Z`),
        playbackId: sessionId,
      });
    }

    const records = await readRecords(directory);
    expect(records.filter(record => record.event === 'header')).toHaveLength(2);
    expect(records.filter(record => record.event === 'session')).toEqual([
      { event: 'session', id: 'session-a' },
      { event: 'session', id: 'session-b' },
    ]);
  });

  it('retains at most the configured number of UTC dates including today', async () => {
    const directory = await temporaryDirectory();
    await Promise.all(
      ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(date =>
        fs.writeFile(path.join(directory, `playback-${date}.jsonl`), '{}\n'),
      ),
    );
    await fs.writeFile(path.join(directory, 'playback-2026-09-14.jsonl.gz'), 'compressed');
    await fs.writeFile(path.join(directory, 'other.jsonl'), '{}\n');
    await fs.writeFile(path.join(directory, 'playback-2026-09-14.jsonl.backup'), '{}\n');
    await fs.writeFile(path.join(directory, 'playback-2026-00-01.jsonl'), '{}\n');
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 3,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    });

    await log.cleanup();

    expect((await fs.readdir(directory)).sort()).toEqual([
      'other.jsonl',
      'playback-2026-00-01.jsonl',
      'playback-2026-09-14.jsonl.backup',
      'playback-2026-09-16.jsonl',
      'playback-2026-09-17.jsonl',
      'playback-2026-09-18.jsonl',
    ]);
  });

  it('does not recreate an expired daily file for a late event', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 2,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    });

    await log.append(eventAt('2026-09-16T23:59:59.999Z'));

    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('does not create future-dated files outside the current retention window', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    });

    await log.append(eventAt('2026-09-19T00:00:00.000Z'));

    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('continues serial writes after an append failure', async () => {
    const directory = await temporaryDirectory();
    const appendFile = vi
      .fn<typeof fs.appendFile>()
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValue(undefined);
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      fileSystem: { ...fs, appendFile },
      sessionId: 'session-a',
    });

    await expect(log.append(eventAt('2026-09-18T10:00:00.000Z'))).rejects.toThrow(
      'disk unavailable',
    );
    await expect(log.append(eventAt('2026-09-18T10:01:00.000Z'))).resolves.toBeUndefined();
    expect(appendFile).toHaveBeenCalledTimes(2);
    const recoveredWrite = String(appendFile.mock.calls[1][1]);
    expect(recoveredWrite.startsWith('\n')).toBe(true);
    expect(recoveredWrite).toContain('"event":"header"');
    expect(recoveredWrite).toContain('"event":"session"');
  });

  it('persists quarantine attribution when the preceding error write failed', async () => {
    const directory = await temporaryDirectory();
    const appendFile = vi
      .fn<typeof fs.appendFile>()
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValue(undefined);
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      fileSystem: { ...fs, appendFile },
      sessionId: 'session-a',
    });
    const error = {
      ...eventAt('2026-09-18T10:00:00.000Z', 'error'),
      attempt: 3,
      quarantined: true,
    };

    await expect(log.append(error)).rejects.toThrow('disk unavailable');
    await expect(log.append({ ...error, event: 'quarantined' })).resolves.toBeUndefined();

    const recoveredWrite = String(appendFile.mock.calls[1][1]);
    expect(recoveredWrite).toContain('"event":"error"');
    expect(recoveredWrite).toContain('"context":1');
    expect(recoveredWrite).toContain('"media":1');
    expect(recoveredWrite).toContain('"quarantined":true');
  });

  it('continues writing when daily retention cleanup fails', async () => {
    const directory = await temporaryDirectory();
    const onMaintenanceError = vi.fn();
    const appendFile = vi.fn<typeof fs.appendFile>().mockResolvedValue(undefined);
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      fileSystem: {
        ...fs,
        readdir: vi.fn<typeof fs.readdir>().mockRejectedValue(new Error('cleanup denied')),
        appendFile,
      },
      onMaintenanceError,
    });

    await expect(log.append(eventAt('2026-09-18T10:00:00.000Z'))).resolves.toBeUndefined();
    expect(appendFile).toHaveBeenCalledOnce();
    expect(onMaintenanceError).toHaveBeenCalledOnce();
  });

  it('bounds incomplete run tracking and restores an evicted run from startedAt', async () => {
    const directory = await temporaryDirectory();
    const appendFile = vi.fn<typeof fs.appendFile>().mockResolvedValue(undefined);
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      fileSystem: { ...fs, appendFile },
      sessionId: 'session-a',
    });
    for (let index = 0; index <= 10_000; index += 1) {
      await log.append({
        ...eventAt('2026-09-18T10:00:00.000Z'),
        playbackId: `run-${index}`,
        startedAt: '2026-09-18T10:00:00.000Z',
      });
    }

    await log.append({
      ...eventAt('2026-09-18T11:00:00.000Z', 'completed'),
      playbackId: 'run-0',
      startedAt: '2026-09-18T10:00:00.000Z',
    });

    const recoveredWrite = String(appendFile.mock.calls.at(-1)?.[1]);
    expect(recoveredWrite).toContain('"event":"continued"');
    expect(recoveredWrite).toContain('"startedAt":"2026-09-18T10:00:00.000Z"');
    expect(recoveredWrite).toContain('"run":10002');
  });

  it('bounds resident daily dictionaries and starts a new block when revisiting one', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 365,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'session-a',
    });
    const first = {
      ...eventAt('2026-09-10T10:00:00.000Z'),
      startedAt: '2026-09-10T10:00:00.000Z',
    };
    await log.append(first);
    for (let day = 11; day <= 18; day += 1) {
      await log.append(eventAt(`2026-09-${day}T10:00:00.000Z`));
    }
    await log.append({
      ...eventAt('2026-09-10T10:30:00.000Z'),
      mediaId: 'other-media',
      playbackId: 'revisited',
    });
    await log.append({
      ...first,
      event: 'completed',
      timestamp: '2026-09-10T11:00:00.000Z',
    });

    const records = await readRecords(directory, '2026-09-10');
    expect(records.filter(record => record.event === 'header')).toHaveLength(2);
    expect(records.filter(record => record.event === 'session')).toHaveLength(2);
    expect(records.filter(record => record.event === 'continued')).toEqual([
      {
        event: 'continued',
        time: '11:00:00.000',
        run: 1,
        context: 1,
        media: 2,
        startedAt: '2026-09-10T10:00:00.000Z',
      },
    ]);
  });

  it('is substantially smaller than repeating full events for normal playback', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
      sessionId: 'session-a',
    });
    const legacy: PlaybackEvent[] = [];
    for (let index = 0; index < 100; index += 1) {
      const startedAt = `2026-09-18T10:${String(index % 60).padStart(2, '0')}:00.000Z`;
      const base = {
        ...eventAt(startedAt),
        mediaId: '0123456789abcdef0123456789abcdef',
        playlistId: 42,
        filename: 'a-long-repeated-advertisement-filename.mp4',
        engine: 'decoder' as const,
        playbackId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        startedAt,
      };
      const completed = { ...base, event: 'completed' as const };
      legacy.push({ ...base, startedAt: undefined }, { ...completed, startedAt: undefined });
      await log.append(base);
      await log.append(completed);
    }

    const compactBytes = Buffer.byteLength(
      await fs.readFile(path.join(directory, 'playback-2026-09-18.jsonl'), 'utf8'),
    );
    const legacyBytes = Buffer.byteLength(legacy.map(event => JSON.stringify(event)).join('\n'));
    expect(compactBytes).toBeLessThan(legacyBytes * 0.45);
  });
});

describe('PlaybackStatusStore', () => {
  it('keeps issues player-specific and only clears them on recovery or completion', () => {
    const store = new PlaybackStatusStore();
    const error = eventAt('2026-09-18T10:00:00.000Z', 'quarantined');
    store.apply(error);
    store.apply({ ...error, playerId: 2, playbackId: 'player-2' });

    expect(store.apply(eventAt('2026-09-18T10:01:00.000Z', 'started'))).toBe(false);
    expect(store.snapshot().issues).toHaveLength(2);
    expect(store.apply(eventAt('2026-09-18T10:02:00.000Z', 'completed'))).toBe(true);
    expect(store.snapshot().issues).toEqual([expect.objectContaining({ playerId: 2 })]);
  });

  it('clears all stale issues for a closed player session', () => {
    const store = new PlaybackStatusStore();
    store.apply(eventAt('2026-09-18T10:00:00.000Z', 'error'));
    store.apply({ ...eventAt('2026-09-18T10:01:00.000Z', 'error'), playerId: 2 });

    expect(store.clearPlayer(1)).toBe(true);
    expect(store.snapshot().issues).toEqual([expect.objectContaining({ playerId: 2 })]);
  });
});

describe('isPlaybackEvent', () => {
  it('accepts the complete event schema', () => {
    expect(
      isPlaybackEvent({
        ...eventAt('2026-09-18T10:00:00.000Z', 'error'),
        playlistId: 4,
        itemId: 'item-1',
        filename: 'clip.mp4',
        engine: 'decoder',
      }),
    ).toBe(true);
  });

  it.each([
    ['invalid timestamp', { ...eventAt('2026-09-18T10:00:00.000Z'), timestamp: 'today' }],
    ['missing error detail', eventAt('2026-09-18T10:00:00.000Z', 'error')],
    ['invalid player id', { ...eventAt('2026-09-18T10:00:00.000Z'), playerId: -1 }],
    ['invalid engine', { ...eventAt('2026-09-18T10:00:00.000Z'), engine: 'html' }],
    ['invalid started at', { ...eventAt('2026-09-18T10:00:00.000Z'), startedAt: 'today' }],
    ['invalid quarantine flag', { ...eventAt('2026-09-18T10:00:00.000Z'), quarantined: 'yes' }],
  ])('rejects %s', (_label, value) => {
    if (_label === 'missing error detail') delete value.error;
    expect(isPlaybackEvent(value)).toBe(false);
  });

  it('requires the event player id to match the attributed sender player', () => {
    const value = eventAt('2026-09-18T10:00:00.000Z');
    expect(isPlaybackEventForPlayer(value, 1)).toBe(true);
    expect(isPlaybackEventForPlayer(value, 2)).toBe(false);
  });
});

describe('broadcastPlaybackRetry', () => {
  it('resolves the managed tab id and sends only to local player views', () => {
    const send = vi.fn();
    const findWindow = vi.fn((id: number) => (id === 42 ? { webContents: { send } } : undefined));
    const base = {
      type: 'player' as const,
      playerId: 1,
      port: 9001,
      parent: {} as never,
      zIndex: 0,
    };

    broadcastPlaybackRetry(
      'media-1',
      [
        { ...base, id: 42, host: 'localhost' },
        { ...base, id: 99, host: 'remote.example' },
      ],
      findWindow,
    );

    expect(findWindow).toHaveBeenCalledExactlyOnceWith(42);
    expect(send).toHaveBeenCalledExactlyOnceWith('playback:retry', 'media-1');
  });
});
