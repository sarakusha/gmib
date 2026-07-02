import debugFactory from 'debug';

import type { Config } from '/@common/config';
import { DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import type { GmibSchedulerJob, GmibSchedulerJobInput } from '/@common/scheduler';
import { getMinuteKey, getNextRunAt, matchesCron } from '/@common/scheduler';

import { dbReady } from './db';
import { getPage } from './page';
import {
  createStoredSchedulerJob,
  deleteStoredSchedulerJob,
  getStoredGmibSchedulerJob,
  getStoredGmibSchedulerJobs,
  updateStoredSchedulerJob,
  updateStoredSchedulerJobResult,
} from './schedulerStore';
import { getScreen, updateScreen } from './screen';
import { updateTest } from './screenOutput';
import { broadcast } from './server';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:gmibScheduler`);

const withNextRunAt = (job: GmibSchedulerJob): GmibSchedulerJob => ({
  ...job,
  nextRunAt: getNextRunAt(job),
});

export const getGmibSchedulerJobs = async (): Promise<GmibSchedulerJob[]> =>
  (await getStoredGmibSchedulerJobs()).map(withNextRunAt);

export const createGmibSchedulerJob = async (
  input: GmibSchedulerJobInput,
): Promise<GmibSchedulerJob> => withNextRunAt(await createStoredSchedulerJob('gmib', input));

export const updateGmibSchedulerJob = (
  id: string,
  input: GmibSchedulerJobInput,
): Promise<GmibSchedulerJob | undefined> =>
  updateStoredSchedulerJob('gmib', id, input).then(job => job && withNextRunAt(job));

export const deleteGmibSchedulerJob = (id: string): Promise<boolean> =>
  deleteStoredSchedulerJob('gmib', id);

const setJobResult = (
  job: GmibSchedulerJob,
  result: Pick<GmibSchedulerJob, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> &
    Partial<Pick<GmibSchedulerJob, 'enabled'>>,
): Promise<void> => updateStoredSchedulerJobResult('gmib', job, result);

const notifyJobResult = (job: GmibSchedulerJob): void => {
  broadcast({
    event: 'gmibScheduler',
    data: [
      {
        id: job.id,
        name: job.name,
        status: job.lastStatus,
        message: job.lastMessage,
      },
    ],
    all: true,
  });
};

const setConfig = async (update: (current: Config) => Config): Promise<void> => {
  const { updateConfigStore } = await import('./nibus');
  updateConfigStore(update);
};

const runJob = async (job: GmibSchedulerJob): Promise<void> => {
  switch (job.action) {
    case 'show-test': {
      if (job.screenId == null) throw new Error('Экран не выбран');
      if (!job.testId) throw new Error('Тест не выбран');
      const page = await getPage(job.testId);
      if (!page) throw new Error(`Тест ${job.testId} не найден`);
      const screen = await getScreen(job.screenId);
      if (!screen) throw new Error(`Экран ${job.screenId} не найден`);
      const nextScreen = { ...screen, test: job.testId };
      await updateScreen(nextScreen);
      await updateTest(nextScreen, true);
      broadcast({ event: 'screen', all: true });
      break;
    }
    case 'hide-test': {
      if (job.screenId == null) throw new Error('Экран не выбран');
      const screen = await getScreen(job.screenId);
      if (!screen) throw new Error(`Экран ${job.screenId} не найден`);
      const nextScreen = { ...screen, test: undefined };
      await updateScreen(nextScreen);
      await updateTest(nextScreen, true);
      broadcast({ event: 'screen', all: true });
      break;
    }
    case 'set-brightness':
      if (typeof job.brightness !== 'number') throw new Error('Яркость не задана');
      await setConfig(current => ({
        ...current,
        brightness: job.brightness ?? current.brightness,
      }));
      break;
    case 'set-autobrightness':
      if (typeof job.enabledValue !== 'boolean') throw new Error('Состояние автояркости не задано');
      await setConfig(current => ({ ...current, autobrightness: Boolean(job.enabledValue) }));
      break;
    case 'set-overheat-protection':
      if (typeof job.enabledValue !== 'boolean') {
        throw new Error('Состояние защиты от перегрева не задано');
      }
      await setConfig(current => ({
        ...current,
        overheatProtection: {
          ...(current.overheatProtection ?? DEFAULT_OVERHEAD_PROTECTION),
          enabled: Boolean(job.enabledValue),
        },
      }));
      break;
    default:
      break;
  }
};

const executeJob = async (
  job: GmibSchedulerJob,
  options: { disableOnce: boolean },
): Promise<GmibSchedulerJob> => {
  const now = new Date();
  const lastRunAt = now.toISOString();
  const lastRunKey = getMinuteKey(now);
  try {
    await runJob(job);
    const nextJob = {
      ...job,
      lastRunAt,
      lastRunKey,
      lastStatus: 'success' as const,
      lastMessage: `Задание "${job.name}" выполнено`,
      ...(options.disableOnce && job.kind === 'once' ? { enabled: false } : {}),
    };
    await setJobResult(job, nextJob);
    notifyJobResult(nextJob);
    return withNextRunAt(nextJob);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug(`error while run job ${job.name}: ${message}`);
    const nextJob = {
      ...job,
      lastRunAt,
      lastRunKey,
      lastStatus: 'error' as const,
      lastMessage: message,
      ...(options.disableOnce && job.kind === 'once' ? { enabled: false } : {}),
    };
    await setJobResult(job, nextJob);
    notifyJobResult(nextJob);
    return withNextRunAt(nextJob);
  }
};

export const runGmibSchedulerJob = async (id: string): Promise<GmibSchedulerJob | undefined> => {
  const job = await getStoredGmibSchedulerJob(id);
  if (!job) return undefined;
  return executeJob(job, { disableOnce: false });
};

const executeDueJobs = async (): Promise<void> => {
  const now = new Date();
  const minuteKey = getMinuteKey(now);
  const dueJobs = (await getStoredGmibSchedulerJobs()).filter(job => {
    if (!job.enabled) return false;
    if (job.kind === 'once') {
      if (!job.runAt) return false;
      return new Date(job.runAt).getTime() <= now.getTime();
    }
    return Boolean(job.cron && job.lastRunKey !== minuteKey && matchesCron(job.cron, now));
  });

  for (const job of dueJobs) {
    await executeJob(job, { disableOnce: true });
  }
};

let timer: NodeJS.Timeout | undefined;

export const startGmibScheduler = (): void => {
  if (timer) return;
  void dbReady.then(() => {
    timer = setInterval(() => {
      void executeDueJobs();
    }, 1000);
    void executeDueJobs();
  });
};
