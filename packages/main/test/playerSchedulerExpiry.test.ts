import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCron, getNextRunAt, type PlayerSchedulerJob } from '/@common/scheduler';

const mocks = vi.hoisted(() => ({
  jobs: new Map<string, PlayerSchedulerJob>(),
  getPlayer: vi.fn(),
  playlist: vi.fn(),
  items: vi.fn(),
  updatePlayer: vi.fn(),
  broadcast: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('../src/finitePlaybackRegistry', () => ({ isFinitePlaybackActive: () => false }));
vi.mock('../src/finitePlaylistPlayback', () => ({ startFinitePlaylist: vi.fn() }));
vi.mock('../src/openHandler', () => ({ setPlayerOutputWindowsVisibility: vi.fn() }));
vi.mock('../src/playlist', () => ({ getPlaylist: mocks.playlist, getPlaylistItems: mocks.items }));
vi.mock('../src/playerRuntime', () => ({ updatePlayerRuntime: mocks.updatePlayer }));
vi.mock('../src/playerOutputHealth', () => ({ checkPlayerOutput: vi.fn() }));
vi.mock('../src/screen', () => ({ getPlayer: mocks.getPlayer }));
vi.mock('../src/server', () => ({ broadcast: mocks.broadcast }));
vi.mock('../src/windowStore', () => ({
  findPlayerWindow: () => ({ webContents: { send: mocks.stop } }),
}));
vi.mock('../src/schedulerStore', () => ({
  createStoredSchedulerJob: vi.fn(),
  deleteStoredSchedulerJob: vi.fn(),
  getStoredPlayerSchedulerJob: async (id: string) => mocks.jobs.get(id),
  getStoredPlayerSchedulerJobs: async () => [...mocks.jobs.values()],
  updateStoredSchedulerJob: vi.fn(),
  updateStoredSchedulerJobResult: async (
    _scope: string,
    job: PlayerSchedulerJob,
    result: Partial<PlayerSchedulerJob>,
  ) => {
    const current = mocks.jobs.get(job.id);
    if (current) mocks.jobs.set(job.id, { ...current, ...result });
  },
  claimExpiredPlayerSchedulerJob: async (job: PlayerSchedulerJob) => {
    const current = mocks.jobs.get(job.id);
    if (!current?.enabled || current.expiresAt !== job.expiresAt) return false;
    mocks.jobs.set(job.id, { ...current, enabled: false });
    return true;
  },
}));

const deadline = '2026-11-14T14:00:00Z';
const makeJob = (overrides: Partial<PlayerSchedulerJob> = {}): PlayerSchedulerJob => ({
  id: 'event',
  name: 'Open day',
  playerId: 1,
  action: 'play',
  kind: 'cron',
  enabled: true,
  priority: 0,
  cron: defaultCron(),
  expiresAt: deadline,
  stopOnExpiry: true,
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(deadline));
  mocks.jobs.clear();
  mocks.getPlayer.mockResolvedValue({ id: 1, autoPlay: true });
  mocks.updatePlayer.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('player scheduler expiry', () => {
  it('does not start playback when the deadline passes while playlist metadata loads', async () => {
    vi.setSystemTime(new Date('2026-11-14T13:59:59Z'));
    const job = makeJob({ action: 'load-playlist', playlistId: 2, stopOnExpiry: false });
    mocks.jobs.set(job.id, job);
    mocks.playlist.mockResolvedValue({ id: 2, name: 'Open day' });
    mocks.items.mockImplementation(async () => {
      vi.setSystemTime(new Date(deadline));
      return [{ id: 'clip' }];
    });
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    expect(await executePlayerSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: false,
    });
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it('disables and stops at the exact deadline only once, including a startup after expiry', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    const expired = await executePlayerSchedulerJob(job, { disableOnce: true, expiryOnly: true });
    expect(expired).toMatchObject({ enabled: false, lastStatus: 'success', nextRunAt: undefined });
    expect(mocks.updatePlayer).toHaveBeenCalledWith(expect.objectContaining({ autoPlay: false }));
    expect(mocks.stop).toHaveBeenCalledWith('stop', 1);
    vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
    await executePlayerSchedulerJob(job, { disableOnce: true });
    expect(mocks.updatePlayer).toHaveBeenCalledOnce();
  });

  it('expires a missed deadline after restarting, without another matching cron occurrence', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    vi.setSystemTime(new Date('2026-11-15T10:03:01Z'));
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    expect(
      await executePlayerSchedulerJob(job, { disableOnce: true, expiryOnly: true }),
    ).toMatchObject({ enabled: false });
    expect(mocks.stop).toHaveBeenCalledWith('stop', 1);
  });

  it('disables without stopping when the option is unchecked', async () => {
    const job = makeJob({ stopOnExpiry: false });
    mocks.jobs.set(job.id, job);
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    expect(await executePlayerSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: false,
    });
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it('never consumes manually disabled or deleted jobs', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, { ...job, enabled: false });
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    await executePlayerSchedulerJob(job, { disableOnce: true });
    mocks.jobs.delete(job.id);
    expect(await executePlayerSchedulerJob(job, { disableOnce: true })).toBeUndefined();
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it('rechecks deadlines when automatic and manual actions leave the queue', async () => {
    vi.setSystemTime(new Date('2026-11-14T13:59:59Z'));
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    const { enqueueSchedulerJob } = await import('../src/schedulerQueue');
    const { executePlayerSchedulerJob, runSchedulerJob } = await import('../src/playerScheduler');
    let release!: () => void;
    const waiting = new Promise<void>(resolve => {
      release = resolve;
    });
    const first = enqueueSchedulerJob(() => waiting);
    const automatic = enqueueSchedulerJob(() =>
      executePlayerSchedulerJob(job, { disableOnce: true }),
    );
    const manual = runSchedulerJob(job.id);
    await Promise.resolve();
    vi.setSystemTime(new Date(deadline));
    release();
    await Promise.all([first, automatic, manual]);
    expect(mocks.updatePlayer).toHaveBeenCalledOnce();
    expect(mocks.updatePlayer).toHaveBeenCalledWith(expect.objectContaining({ autoPlay: false }));
  });

  it('does not execute a stale expiry after the user extends the deadline', async () => {
    const queued = makeJob();
    mocks.jobs.set(queued.id, { ...queued, expiresAt: '2026-11-15T14:00:00Z' });
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    expect(
      await executePlayerSchedulerJob(queued, { disableOnce: true, expiryOnly: true }),
    ).toMatchObject({ enabled: true });
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it('keeps the task disabled and reports an error if stopping fails', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    mocks.updatePlayer.mockRejectedValueOnce(new Error('output failed'));
    const { executePlayerSchedulerJob } = await import('../src/playerScheduler');
    expect(await executePlayerSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: false,
      lastStatus: 'error',
    });
    await executePlayerSchedulerJob(job, { disableOnce: true });
    expect(mocks.updatePlayer).toHaveBeenCalledOnce();
  });
});

describe('next run with an exclusive deadline', () => {
  it('shows an occurrence strictly before the deadline', () => {
    const job = makeJob();
    expect(getNextRunAt(job, new Date('2026-11-14T13:49:59Z'))).toBe('2026-11-14T13:50:00.000Z');
  });
  it('omits the occurrence at the deadline and all later occurrences', () => {
    expect(getNextRunAt(makeJob(), new Date('2026-11-14T13:59:59Z'))).toBeUndefined();
    expect(
      getNextRunAt(
        makeJob({ expiresAt: '2026-11-14T13:55:00Z' }),
        new Date('2026-11-14T13:50:00Z'),
      ),
    ).toBeUndefined();
    expect(getNextRunAt(makeJob(), new Date(deadline))).toBeUndefined();
  });
});
