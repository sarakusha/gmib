import debugFactory from 'debug';
import Store from 'electron-store';

import type { Config } from '/@common/config';
import { DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import type { GmibSchedulerJob, GmibSchedulerJobInput } from '/@common/scheduler';
import { getMinuteKey, getNextRunAt, matchesCron, normalizeSelected } from '/@common/scheduler';

import { dbReady } from './db';
import { getPage } from './page';
import { getScreen, updateScreen } from './screen';
import { updateTest } from './screenOutput';
import { broadcast } from './server';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:gmibScheduler`);

type SchedulerStore = {
  jobs: GmibSchedulerJob[];
};

const store = new Store<SchedulerStore>({
  name: `${import.meta.env.VITE_APP_NAME}-gmib-scheduler`,
  defaults: {
    jobs: [],
  },
  watch: true,
});

const createId = (): string => crypto.randomUUID();

const sanitizeJob = (job: GmibSchedulerJob): GmibSchedulerJob => {
  const { nextRunAt: _, brightness, ...storedJob } = job;
  return {
    ...storedJob,
    brightness:
      typeof brightness === 'number'
        ? Math.round(Math.max(Math.min(brightness, 100), 0))
        : undefined,
    cron: storedJob.cron
      ? {
          minutes: {
            ...storedJob.cron.minutes,
            selected: normalizeSelected(storedJob.cron.minutes.selected),
          },
          hours: {
            ...storedJob.cron.hours,
            selected: normalizeSelected(storedJob.cron.hours.selected),
          },
          days: {
            ...storedJob.cron.days,
            selected: normalizeSelected(storedJob.cron.days.selected),
          },
          months: {
            ...storedJob.cron.months,
            selected: normalizeSelected(storedJob.cron.months.selected),
          },
          weekdays: {
            ...storedJob.cron.weekdays,
            selected: normalizeSelected(storedJob.cron.weekdays.selected),
          },
        }
      : undefined,
  };
};

const withNextRunAt = (job: GmibSchedulerJob): GmibSchedulerJob => ({
  ...job,
  nextRunAt: getNextRunAt(job),
});

const getStoredJobs = (): GmibSchedulerJob[] => store.get('jobs', []);

const setStoredJobs = (jobs: GmibSchedulerJob[]): void => {
  store.set('jobs', jobs.map(sanitizeJob));
};

export const getGmibSchedulerJobs = (): GmibSchedulerJob[] => getStoredJobs().map(withNextRunAt);

export const createGmibSchedulerJob = (input: GmibSchedulerJobInput): GmibSchedulerJob => {
  const job = sanitizeJob({
    ...input,
    id: input.id ?? createId(),
    enabled: input.enabled,
    lastStatus: 'idle',
  });
  setStoredJobs([...getStoredJobs(), job]);
  return withNextRunAt(job);
};

export const updateGmibSchedulerJob = (
  id: string,
  input: GmibSchedulerJobInput,
): GmibSchedulerJob | undefined => {
  let updated: GmibSchedulerJob | undefined;
  setStoredJobs(
    getStoredJobs().map(job => {
      if (job.id !== id) return job;
      const scheduleChanged =
        input.kind !== job.kind ||
        input.runAt !== job.runAt ||
        JSON.stringify(input.cron) !== JSON.stringify(job.cron);
      updated = sanitizeJob({
        ...job,
        ...input,
        id,
        lastRunAt: scheduleChanged ? undefined : job.lastRunAt,
        lastRunKey: scheduleChanged ? undefined : job.lastRunKey,
        lastStatus: scheduleChanged ? 'idle' : job.lastStatus,
        lastMessage: scheduleChanged ? undefined : job.lastMessage,
      });
      return updated;
    }),
  );
  return updated && withNextRunAt(updated);
};

export const deleteGmibSchedulerJob = (id: string): boolean => {
  const jobs = getStoredJobs();
  const nextJobs = jobs.filter(job => job.id !== id);
  if (nextJobs.length === jobs.length) return false;
  setStoredJobs(nextJobs);
  return true;
};

const setJobResult = (
  job: GmibSchedulerJob,
  result: Pick<GmibSchedulerJob, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> &
    Partial<Pick<GmibSchedulerJob, 'enabled'>>,
): void => {
  setStoredJobs(getStoredJobs().map(item => (item.id === job.id ? { ...item, ...result } : item)));
};

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
    setJobResult(job, nextJob);
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
    setJobResult(job, nextJob);
    notifyJobResult(nextJob);
    return withNextRunAt(nextJob);
  }
};

export const runGmibSchedulerJob = async (id: string): Promise<GmibSchedulerJob | undefined> => {
  const job = getStoredJobs().find(item => item.id === id);
  if (!job) return undefined;
  return executeJob(job, { disableOnce: false });
};

const executeDueJobs = async (): Promise<void> => {
  const now = new Date();
  const minuteKey = getMinuteKey(now);
  const dueJobs = getStoredJobs().filter(job => {
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
  debug(`scheduler store: ${store.path}`);
  void dbReady.then(() => {
    timer = setInterval(() => {
      void executeDueJobs();
    }, 1000);
    void executeDueJobs();
  });
};
