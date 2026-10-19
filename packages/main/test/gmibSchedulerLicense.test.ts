import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GmibSchedulerJob } from '/@common/scheduler';

const mocks = vi.hoisted(() => ({
  status: 'expired',
  getJob: vi.fn(),
  setResult: vi.fn(),
  broadcast: vi.fn(),
  updateConfig: vi.fn(),
}));
vi.mock('../src/licenseState', () => ({ getLicenseState: () => ({ status: mocks.status }) }));
vi.mock('../src/nibus', () => ({ updateConfigStore: mocks.updateConfig }));
vi.mock('../src/server', () => ({ broadcast: mocks.broadcast }));
vi.mock('../src/page', () => ({ getPage: vi.fn() }));
vi.mock('../src/screen', () => ({ getScreen: vi.fn(), updateScreen: vi.fn() }));
vi.mock('../src/screenOutput', () => ({ updateTest: vi.fn() }));
vi.mock('../src/schedulerStore', () => ({
  createStoredSchedulerJob: vi.fn(),
  deleteStoredSchedulerJob: vi.fn(),
  getStoredGmibSchedulerJob: mocks.getJob,
  getStoredGmibSchedulerJobs: vi.fn(),
  updateStoredSchedulerJob: vi.fn(),
  updateStoredSchedulerJobResult: mocks.setResult,
}));

const job = (action: GmibSchedulerJob['action']): GmibSchedulerJob => ({
  id: 'scheduled',
  name: 'Scheduled action',
  kind: 'once',
  runAt: '2020-01-01T00:00:00Z',
  enabled: true,
  priority: 0,
  action,
  enabledValue: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = 'expired';
});

describe('GMIB scheduler licensing', () => {
  it.each(['set-autobrightness', 'set-overheat-protection'] as const)(
    'rejects manual and queued %s without consuming the job',
    async action => {
      const { runGmibSchedulerJob, executeGmibSchedulerJob } = await import('../src/gmibScheduler');
      const stored = job(action);
      mocks.getJob.mockResolvedValue(stored);
      await expect(runGmibSchedulerJob(stored.id)).rejects.toMatchObject({ status: 403 });
      await expect(executeGmibSchedulerJob(stored, { disableOnce: true })).rejects.toMatchObject({
        status: 403,
      });
      expect(mocks.updateConfig).not.toHaveBeenCalled();
      expect(mocks.setResult).not.toHaveBeenCalled();
      expect(mocks.broadcast).not.toHaveBeenCalled();
      expect(stored.enabled).toBe(true);

      mocks.status = 'active';
      await expect(runGmibSchedulerJob(stored.id)).resolves.toMatchObject({
        lastStatus: 'success',
      });
      expect(mocks.updateConfig).toHaveBeenCalledOnce();
    },
  );
});
