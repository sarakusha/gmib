import debugFactory from 'debug';

import type { GmibSchedulerJob, PlayerSchedulerJob, SchedulerJobBase } from '/@common/scheduler';
import { getRunKey, matchesCron } from '/@common/scheduler';

import { dbReady, onBeforeDatabaseClose } from './db';
import { executeGmibSchedulerJob } from './gmibScheduler';
import { executePlayerSchedulerJob } from './playerScheduler';
import { enqueueSchedulerJob, stopSchedulerQueue } from './schedulerQueue';
import { compareSchedulerOrder } from './schedulerOrder';
import { getStoredGmibSchedulerJobs, getStoredPlayerSchedulerJobs } from './schedulerStore';

type DueJob =
  | { scope: 'gmib'; job: GmibSchedulerJob; scheduledAt: number; occurrenceKey: string }
  | { scope: 'player'; job: PlayerSchedulerJob; scheduledAt: number; occurrenceKey: string };

const getScheduledAt = (job: SchedulerJobBase, now: Date): number | undefined => {
  if (!job.enabled) return undefined;
  if (job.kind === 'once') {
    if (!job.runAt) return undefined;
    const scheduledAt = new Date(job.runAt).getTime();
    return Number.isNaN(scheduledAt) || scheduledAt > now.getTime() ? undefined : scheduledAt;
  }
  const runKey = getRunKey(now);
  return job.cron && job.lastRunKey !== runKey && matchesCron(job.cron, now)
    ? new Date(now).setMilliseconds(0)
    : undefined;
};

const executeDueJobs = async (): Promise<void> => {
  const now = new Date();
  const [gmibJobs, playerJobs] = await Promise.all([
    getStoredGmibSchedulerJobs(),
    getStoredPlayerSchedulerJobs(),
  ]);
  if (stopped) return;
  const dueJobs: DueJob[] = [];

  for (const job of gmibJobs) {
    const scheduledAt = getScheduledAt(job, now);
    if (scheduledAt !== undefined) {
      const occurrenceKey = `gmib:${job.id}:${job.kind === 'once' ? job.runAt : getRunKey(now)}`;
      dueJobs.push({ scope: 'gmib', job, scheduledAt, occurrenceKey });
    }
  }
  for (const job of playerJobs) {
    const scheduledAt = getScheduledAt(job, now);
    if (scheduledAt !== undefined) {
      const occurrenceKey = `player:${job.id}:${job.kind === 'once' ? job.runAt : getRunKey(now)}`;
      dueJobs.push({ scope: 'player', job, scheduledAt, occurrenceKey });
    }
  }

  for (const item of dueJobs.sort(compareSchedulerOrder)) {
    if (queuedOccurrences.has(item.occurrenceKey)) continue;
    queuedOccurrences.add(item.occurrenceKey);
    let execution: Promise<GmibSchedulerJob | PlayerSchedulerJob>;
    if (item.scope === 'gmib') {
      execution = enqueueSchedulerJob(() =>
        executeGmibSchedulerJob(item.job, { disableOnce: true }),
      );
    } else {
      execution = enqueueSchedulerJob(() =>
        executePlayerSchedulerJob(item.job, { disableOnce: true }),
      );
    }
    void execution.then(
      () => queuedOccurrences.delete(item.occurrenceKey),
      () => queuedOccurrences.delete(item.occurrenceKey),
    );
  }
};

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:scheduler`);
let timer: NodeJS.Timeout | undefined;
let checking: Promise<void> | undefined;
let started = false;
let stopped = false;
const queuedOccurrences = new Set<string>();

const checkDueJobs = (): Promise<void> => {
  if (checking) return checking;
  if (stopped) return Promise.resolve();
  checking = executeDueJobs()
    .catch(error => {
      debug(
        `Failed to check scheduled jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    })
    .finally(() => {
      checking = undefined;
    });
  return checking;
};

export const stopScheduler = async (): Promise<void> => {
  stopped = true;
  if (timer) clearInterval(timer);
  timer = undefined;
  // Reject queued jobs immediately; a running job may still need to write its result.
  await Promise.all([checking, stopSchedulerQueue()]);
};

onBeforeDatabaseClose(stopScheduler);

export const startScheduler = (): void => {
  if (started || stopped) return;
  started = true;
  void dbReady
    .then(() => {
      if (stopped) return;
      timer = setInterval(() => void checkDueJobs(), 1000);
      timer.unref();
      void checkDueJobs();
    })
    .catch(error => {
      debug(`Failed to start scheduler: ${error instanceof Error ? error.message : String(error)}`);
    });
};
