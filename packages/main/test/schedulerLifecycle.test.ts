import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ready: Promise.resolve() as Promise<void>,
  onClose: vi.fn(),
  gmibJobs: vi.fn(),
  playerJobs: vi.fn(),
  executeGmib: vi.fn(),
  executePlayer: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('../src/db', () => ({
  get dbReady() {
    return mocks.ready;
  },
  onBeforeDatabaseClose: mocks.onClose,
}));
vi.mock('../src/schedulerStore', () => ({
  getStoredGmibSchedulerJobs: mocks.gmibJobs,
  getStoredPlayerSchedulerJobs: mocks.playerJobs,
}));
vi.mock('../src/gmibScheduler', () => ({ executeGmibSchedulerJob: mocks.executeGmib }));
vi.mock('../src/playerScheduler', () => ({ executePlayerSchedulerJob: mocks.executePlayer }));
vi.mock('debug', () => ({ default: () => mocks.debug }));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const job = (id: string) => ({
  id,
  enabled: true,
  kind: 'once',
  runAt: '2020-01-01T00:00:00Z',
  priority: 0,
  name: id,
  action: 'hide-test',
});

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.ready = Promise.resolve();
  mocks.gmibJobs.mockReset().mockResolvedValue([]);
  mocks.playerJobs.mockReset().mockResolvedValue([]);
  mocks.executeGmib.mockReset().mockImplementation(async value => value);
  mocks.executePlayer.mockReset().mockImplementation(async value => value);
});
afterEach(() => vi.useRealTimers());

describe('scheduler database shutdown lifecycle', () => {
  it('does not start a late timer after shutdown while dbReady is pending', async () => {
    const ready = deferred<void>();
    mocks.ready = ready.promise;
    const { startScheduler } = await import('../src/scheduler');
    startScheduler();
    startScheduler();
    await mocks.onClose.mock.calls[0][0]();
    ready.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.gmibJobs).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    startScheduler();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.gmibJobs).not.toHaveBeenCalled();
  });

  it('starts only once and stops all future database polling', async () => {
    const { startScheduler, stopScheduler } = await import('../src/scheduler');
    startScheduler();
    startScheduler();
    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.gmibJobs).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
    await stopScheduler();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.gmibJobs).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for an in-flight query but never schedules its results after stopping', async () => {
    const rows = deferred<unknown[]>();
    mocks.gmibJobs.mockReturnValue(rows.promise);
    const { startScheduler, stopScheduler } = await import('../src/scheduler');
    startScheduler();
    await vi.advanceTimersByTimeAsync(0);
    let finished = false;
    const stop = stopScheduler().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    rows.resolve([job('late')]);
    await stop;
    expect(mocks.executeGmib).not.toHaveBeenCalled();
  });

  it('lets a running job persist its result and cancels queued jobs before closing SQL', async () => {
    const running = deferred<void>();
    mocks.gmibJobs.mockResolvedValue([job('first'), job('second')]);
    mocks.executeGmib.mockImplementation(async value => {
      await running.promise;
      return value;
    });
    const { startScheduler, stopScheduler } = await import('../src/scheduler');
    startScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.executeGmib).toHaveBeenCalledTimes(1);
    let finished = false;
    const stop = stopScheduler().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    running.resolve();
    await stop;
    expect(mocks.executeGmib).toHaveBeenCalledTimes(1);
    const { enqueueSchedulerJob } = await import('../src/schedulerQueue');
    await expect(enqueueSchedulerJob(async () => 1)).rejects.toThrow('Scheduler is stopping');
  });

  it('handles read and initialization failures without unhandled rejections', async () => {
    mocks.gmibJobs.mockRejectedValueOnce(new Error('read failed'));
    const { startScheduler, stopScheduler } = await import('../src/scheduler');
    startScheduler();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.debug).toHaveBeenCalledWith(expect.stringContaining('read failed'));
    expect(mocks.gmibJobs).toHaveBeenCalledTimes(2);
    await stopScheduler();
    vi.resetModules();
    const ready = deferred<void>();
    mocks.ready = ready.promise;
    const next = await import('../src/scheduler');
    next.startScheduler();
    ready.reject(new Error('init failed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.debug).toHaveBeenCalledWith(expect.stringContaining('init failed'));
    expect(vi.getTimerCount()).toBe(0);
    await next.stopScheduler();
  });
});
