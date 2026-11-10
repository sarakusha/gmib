import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCron, getNextRunAt, type GmibSchedulerJob } from '/@common/scheduler';

const mocks = vi.hoisted(() => ({
  jobs: new Map<string, GmibSchedulerJob>(),
  status: 'active',
  page: vi.fn(),
  screen: vi.fn(),
  updateScreen: vi.fn(),
  updateTest: vi.fn(),
  updateConfig: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('../src/licenseState', () => ({ getLicenseState: () => ({ status: mocks.status }) }));
vi.mock('../src/nibus', () => ({ updateConfigStore: mocks.updateConfig }));
vi.mock('../src/page', () => ({ getPage: mocks.page }));
vi.mock('../src/screen', () => ({ getScreen: mocks.screen, updateScreen: mocks.updateScreen }));
vi.mock('../src/screenOutput', () => ({ updateTest: mocks.updateTest }));
vi.mock('../src/server', () => ({ broadcast: mocks.broadcast }));
vi.mock('../src/schedulerStore', () => ({
  createStoredSchedulerJob: vi.fn(),
  deleteStoredSchedulerJob: vi.fn(),
  updateStoredSchedulerJob: vi.fn(),
  getStoredGmibSchedulerJobs: async () => [...mocks.jobs.values()],
  getStoredGmibSchedulerJob: async (id: string) => mocks.jobs.get(id),
  updateStoredSchedulerJobResult: async (
    _scope: string,
    job: GmibSchedulerJob,
    result: Partial<GmibSchedulerJob>,
  ) => {
    const current = mocks.jobs.get(job.id);
    if (current) mocks.jobs.set(job.id, { ...current, ...result });
  },
  claimExpiredGmibSchedulerJob: async (job: GmibSchedulerJob) => {
    const current = mocks.jobs.get(job.id);
    if (!current?.enabled || current.expiresAt !== job.expiresAt) return false;
    mocks.jobs.set(job.id, {
      ...current,
      enabled: false,
      lastStatus: 'success',
      lastMessage: 'Срок действия задания истёк',
    });
    return true;
  },
}));
const deadline = '2026-11-14T14:00:00Z';
const makeJob = (overrides: Partial<GmibSchedulerJob> = {}): GmibSchedulerJob => ({
  id: 'event',
  name: 'Open day',
  action: 'show-test',
  screenId: 1,
  testId: 'test',
  kind: 'cron',
  cron: defaultCron(),
  enabled: true,
  priority: 0,
  expiresAt: deadline,
  ...overrides,
});
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(deadline));
  mocks.jobs.clear();
  mocks.status = 'active';
  mocks.page.mockResolvedValue({ id: 'test' });
  mocks.screen.mockResolvedValue({ id: 1 });
});
afterEach(() => vi.useRealTimers());

describe('GMIB scheduler expiry', () => {
  it('disables at the deadline without reversing output and does not process twice', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    const { executeGmibSchedulerJob } = await import('../src/gmibScheduler');
    expect(await executeGmibSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: false,
      nextRunAt: undefined,
    });
    await executeGmibSchedulerJob(job, { disableOnce: true });
    expect(mocks.updateTest).not.toHaveBeenCalled();
    expect(mocks.updateConfig).not.toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledOnce();
  });
  it('expires a missed deadline without requiring the action license', async () => {
    const job = makeJob({ action: 'set-overheat-protection', enabledValue: false });
    mocks.jobs.set(job.id, job);
    mocks.status = 'expired';
    vi.setSystemTime(new Date('2026-11-15T14:00:00Z'));
    const { runGmibSchedulerJob } = await import('../src/gmibScheduler');
    expect(await runGmibSchedulerJob(job.id)).toMatchObject({ enabled: false });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
  it('preserves disabled/deleted tasks and deadlines extended while queued', async () => {
    const job = makeJob();
    const { executeGmibSchedulerJob } = await import('../src/gmibScheduler');
    mocks.jobs.set(job.id, { ...job, enabled: false });
    await executeGmibSchedulerJob(job, { disableOnce: true });
    mocks.jobs.delete(job.id);
    expect(await executeGmibSchedulerJob(job, { disableOnce: true })).toBeUndefined();
    mocks.jobs.set(job.id, { ...job, expiresAt: '2026-11-15T14:00:00Z' });
    expect(
      await executeGmibSchedulerJob(job, { disableOnce: true, expiryOnly: true }),
    ).toMatchObject({ enabled: true });
    expect(mocks.updateTest).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });
  it('rechecks queued automatic and manual actions at execution', async () => {
    vi.setSystemTime(new Date('2026-11-14T13:59:59Z'));
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    const { enqueueSchedulerJob } = await import('../src/schedulerQueue');
    const { executeGmibSchedulerJob, runGmibSchedulerJob } = await import('../src/gmibScheduler');
    let release!: () => void;
    const first = enqueueSchedulerJob(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    const automatic = enqueueSchedulerJob(() =>
      executeGmibSchedulerJob(job, { disableOnce: true }),
    );
    const manual = runGmibSchedulerJob(job.id);
    await Promise.resolve();
    vi.setSystemTime(new Date(deadline));
    release();
    await Promise.all([first, automatic, manual]);
    expect(mocks.jobs.get(job.id)?.enabled).toBe(false);
    expect(mocks.updateTest).not.toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledOnce();
  });
  it('does not show output when expiry passes during preparation', async () => {
    vi.setSystemTime(new Date('2026-11-14T13:59:59Z'));
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    mocks.screen.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date(deadline));
      return { id: 1 };
    });
    const { executeGmibSchedulerJob } = await import('../src/gmibScheduler');
    expect(await executeGmibSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: false,
    });
    expect(mocks.updateScreen).not.toHaveBeenCalled();
    expect(mocks.updateTest).not.toHaveBeenCalled();
  });
  it('still executes before the deadline and excludes boundary next runs', async () => {
    const job = makeJob();
    mocks.jobs.set(job.id, job);
    vi.setSystemTime(new Date('2026-11-14T13:49:59Z'));
    expect(getNextRunAt(job)).toBe('2026-11-14T13:50:00.000Z');
    const { executeGmibSchedulerJob } = await import('../src/gmibScheduler');
    expect(await executeGmibSchedulerJob(job, { disableOnce: true })).toMatchObject({
      enabled: true,
      lastStatus: 'success',
    });
    expect(mocks.updateTest).toHaveBeenCalledOnce();
    expect(getNextRunAt(job, new Date('2026-11-14T13:59:59Z'))).toBeUndefined();
  });
});
