import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  onBeforeClose: vi.fn(),
  retentionDays: 30,
  get: vi.fn(),
}));
vi.mock('electron', () => ({ app: { getPath: mocks.getPath } }));
vi.mock('../src/db', () => ({ onBeforeDatabaseClose: mocks.onBeforeClose }));
vi.mock('../src/localConfig', () => ({ default: { get: mocks.get } }));
let directory: string;
const stores: PlaybackStatisticsStore[] = [];
const makeEvent = (at = new Date()): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId: randomUUID(),
  playerId: 2,
  mediaId: 'media',
  filename: 'media.mp4',
  attempt: 1,
  event: 'started',
  timestamp: at.toISOString(),
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
};
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2020-10-09T12:00:00.000Z'));
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-statistics-lifetime-'));
  mocks.retentionDays = 30;
  mocks.getPath.mockImplementation(name => {
    if (name !== 'userData') throw new Error('Unexpected Electron path');
    return directory;
  });
  mocks.get.mockImplementation(name => {
    if (name !== 'playbackLogRetentionDays') throw new Error('Unexpected configuration key');
    return mocks.retentionDays;
  });
});
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
  vi.useRealTimers();
  await fs.rm(directory, { recursive: true, force: true });
});

describe('playback statistics application database lifetime', () => {
  it('creates one lazy shared database in the real Electron user-data directory and reads current retention', async () => {
    const module = await import('../src/playbackStatisticsDatabase');
    expect(mocks.onBeforeClose).toHaveBeenCalledTimes(1);
    expect(mocks.getPath).not.toHaveBeenCalled();
    expect(await fs.readdir(directory)).toEqual([]);
    const store = module.getPlaybackStatisticsStore();
    stores.push(store);
    expect(module.getPlaybackStatisticsStore()).toBe(store);
    expect(module.getPlaybackStatisticsPath()).toBe(path.join(directory, 'playback.sqlite'));
    await store.ready;
    expect(await fs.stat(module.getPlaybackStatisticsPath())).toMatchObject({
      size: expect.any(Number),
    });
    await store.append(makeEvent(new Date('2020-10-08T12:00:00.000Z')));
    await store.append(makeEvent());
    expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM attempts'))).toEqual({
      count: 2,
    });
    mocks.retentionDays = 1;
    await store.cleanup();
    expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM attempts'))).toEqual({
      count: 1,
    });
    expect(mocks.get).toHaveBeenCalledWith('playbackLogRetentionDays');
  });

  it('drains accepted queued writes before closing and never recreates the database after shutdown', async () => {
    const module = await import('../src/playbackStatisticsDatabase');
    const store = module.getPlaybackStatisticsStore();
    stores.push(store);
    await store.ready;
    const gate = deferred();
    const started = deferred();
    const active = store.read(async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;
    const writes = Array.from({ length: 8 }, () => store.append(makeEvent()));
    let finished = false;
    const closing = mocks.onBeforeClose.mock.calls[0][0]().then(() => {
      finished = true;
    });
    expect(() => module.getPlaybackStatisticsStore()).toThrow('closing');
    await expect(store.append(makeEvent())).rejects.toThrow('closing');
    await Promise.resolve();
    expect(finished).toBe(false);
    gate.resolve();
    await active;
    await Promise.all(writes);
    await closing;
    expect(finished).toBe(true);
    expect(() => module.getPlaybackStatisticsStore()).toThrow('closing');
    await expect(store.read(db => db.get('SELECT 1'))).rejects.toThrow('closing');
    const reopened = new PlaybackStatisticsStore(module.getPlaybackStatisticsPath());
    stores.push(reopened);
    expect(await reopened.read(db => db.get('SELECT COUNT(*) AS count FROM attempts'))).toEqual({
      count: 8,
    });
  });

  it('allows shutdown before first use without creating files or permitting late initialization', async () => {
    const module = await import('../src/playbackStatisticsDatabase');
    await mocks.onBeforeClose.mock.calls[0][0]();
    expect(() => module.getPlaybackStatisticsStore()).toThrow('closing');
    expect(mocks.getPath).not.toHaveBeenCalled();
    expect(await fs.readdir(directory)).toEqual([]);
    await mocks.onBeforeClose.mock.calls[0][0]();
  });
});
