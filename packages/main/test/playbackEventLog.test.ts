import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackEvent } from '/@common/playback';
import { isPlaybackEvent, isPlaybackEventForPlayer } from '/@common/playback';
import { cleanupLegacyPlaybackLogs } from '../src/playbackEventLog';
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

describe('legacy playback log cleanup', () => {
  it('deletes only expired daily logs and preserves retained, unrelated and invalid names', async () => {
    const directory = await temporaryDirectory();
    const expired = ['playback-2026-09-01.jsonl', 'playback-2026-09-11.jsonl.gz'];
    const retained = [
      'playback-2026-09-12.jsonl',
      'playback-2026-09-18.jsonl.gz',
      'playback-2026-09-19.jsonl',
      'playback-2026-02-30.jsonl',
      'playback-2026-09-01.jsonl.backup',
      'playback-2026-09-1.jsonl',
      'notes.jsonl',
      'playback.sqlite',
    ];
    await Promise.all(
      [...expired, ...retained].map(filename =>
        fs.writeFile(path.join(directory, filename), 'data'),
      ),
    );
    const nestedDirectory = 'playback-2026-09-02.jsonl';
    await fs.mkdir(path.join(directory, nestedDirectory));
    await cleanupLegacyPlaybackLogs(directory, 7, new Date('2026-09-18T00:00:00.000Z'));
    expect((await fs.readdir(directory)).sort()).toEqual([...retained, nestedDirectory].sort());
    expect(await fs.readFile(path.join(directory, 'playback.sqlite'), 'utf8')).toBe('data');
  });

  it('keeps the current UTC day with one-day retention and handles leap days', async () => {
    const directory = await temporaryDirectory();
    const names = [
      'playback-2024-02-28.jsonl',
      'playback-2024-02-29.jsonl',
      'playback-2024-02-30.jsonl',
    ];
    await Promise.all(names.map(filename => fs.writeFile(path.join(directory, filename), 'data')));
    await cleanupLegacyPlaybackLogs(directory, 1, new Date('2024-02-29T23:59:59.999Z'));
    expect((await fs.readdir(directory)).sort()).toEqual(names.slice(1));
  });

  it('does not create a missing log directory', async () => {
    const directory = path.join(await temporaryDirectory(), 'missing');
    await expect(cleanupLegacyPlaybackLogs(directory, 7)).resolves.toBeUndefined();
    await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([0, -1, 1.5, 366, Number.NaN])(
    'rejects an invalid retention %s before deletion',
    async days => {
      const directory = await temporaryDirectory();
      const filename = 'playback-2020-01-01.jsonl';
      await fs.writeFile(path.join(directory, filename), 'data');
      await expect(cleanupLegacyPlaybackLogs(directory, days)).rejects.toThrow(
        'Invalid playback log retention',
      );
      expect(await fs.readdir(directory)).toEqual([filename]);
    },
  );
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

describe('v3 statistics records', () => {
  const progress: PlaybackEvent = {
    ...eventAt('2026-09-18T00:00:01.000Z'),
    version: 3,
    eventId: '12345678-1234-4234-8234-123456789abc',
    playbackId: '12345678-1234-4234-8234-123456789def',
    event: 'progress',
    segmentStartedAt: '2026-09-17T23:59:59.000Z',
    playedMs: 2000,
    startedAt: '2026-09-17T23:59:59.000Z',
    filename: 'clip.mp4',
    playlistId: 4,
  };

  it('validates the version, deduplication identity and active interval', () => {
    expect(isPlaybackEvent(progress)).toBe(true);
    expect(isPlaybackEvent({ ...progress, version: 4 })).toBe(false);
    expect(isPlaybackEvent({ ...progress, eventId: undefined })).toBe(false);
    expect(isPlaybackEvent({ ...progress, playbackId: 'legacy-id' })).toBe(false);
    expect(isPlaybackEvent({ ...progress, playedMs: NaN })).toBe(false);
    expect(isPlaybackEvent({ ...progress, playedMs: -1 })).toBe(false);
    expect(isPlaybackEvent({ ...progress, playedMs: 2001 })).toBe(false);
    expect(isPlaybackEvent({ ...progress, segmentStartedAt: progress.timestamp })).toBe(false);
    expect(
      isPlaybackEvent({ ...progress, segmentStartedAt: '2026-09-19T00:00:00.000Z', playedMs: 0 }),
    ).toBe(false);
    expect(isPlaybackEvent({ ...progress, event: 'started' })).toBe(false);
    expect(isPlaybackEvent({ ...progress, event: 'completed', segmentStartedAt: undefined })).toBe(
      false,
    );
    expect(isPlaybackEvent({ ...progress, event: 'started', playedMs: undefined })).toBe(false);
    const seek = {
      ...progress,
      event: 'seeked',
      segmentStartedAt: undefined,
      playedMs: undefined,
      position: 30,
      previousPosition: 10,
    };
    expect(isPlaybackEvent(seek)).toBe(true);
    expect(isPlaybackEvent({ ...seek, position: Infinity })).toBe(false);
    expect(isPlaybackEvent({ ...seek, previousPosition: -1 })).toBe(false);
    expect(isPlaybackEvent({ ...seek, event: 'started' })).toBe(false);
  });
});
