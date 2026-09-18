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

  it('rotates JSONL files by the UTC event date', async () => {
    const directory = await temporaryDirectory();
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 7,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    });

    await log.append(eventAt('2026-09-17T23:59:59.999Z'));
    await log.append(eventAt('2026-09-18T00:00:00.000Z', 'completed'));

    expect((await fs.readdir(directory)).sort()).toEqual([
      'playback-2026-09-17.jsonl',
      'playback-2026-09-18.jsonl',
    ]);
    expect(await fs.readFile(path.join(directory, 'playback-2026-09-18.jsonl'), 'utf8')).toBe(
      `${JSON.stringify(eventAt('2026-09-18T00:00:00.000Z', 'completed'))}\n`,
    );
  });

  it('retains at most the configured number of UTC dates including today', async () => {
    const directory = await temporaryDirectory();
    await Promise.all(
      ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(date =>
        fs.writeFile(path.join(directory, `playback-${date}.jsonl`), '{}\n'),
      ),
    );
    await fs.writeFile(path.join(directory, 'other.jsonl'), '{}\n');
    const log = new PlaybackEventLog({
      directory,
      retentionDays: () => 3,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    });

    await log.cleanup();

    expect((await fs.readdir(directory)).sort()).toEqual([
      'other.jsonl',
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
    });

    await expect(log.append(eventAt('2026-09-18T10:00:00.000Z'))).rejects.toThrow(
      'disk unavailable',
    );
    await expect(log.append(eventAt('2026-09-18T10:01:00.000Z'))).resolves.toBeUndefined();
    expect(appendFile).toHaveBeenCalledTimes(2);
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
