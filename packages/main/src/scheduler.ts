import type { GmibSchedulerJob, PlayerSchedulerJob, SchedulerJobBase } from '/@common/scheduler';
import { getRunKey, matchesCron } from '/@common/scheduler';

import { dbReady } from './db';
import { executeGmibSchedulerJob } from './gmibScheduler';
import { executePlayerSchedulerJob } from './playerScheduler';
import { enqueueSchedulerJob } from './schedulerQueue';
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

let timer: NodeJS.Timeout | undefined;
let checking = false;
const queuedOccurrences = new Set<string>();

const checkDueJobs = async (): Promise<void> => {
  if (checking) return;
  checking = true;
  try {
    await executeDueJobs();
  } finally {
    checking = false;
  }
};

export const startScheduler = (): void => {
  if (timer) return;
  void dbReady.then(() => {
    timer = setInterval(() => void checkDueJobs(), 1000);
    void checkDueJobs();
  });
};
