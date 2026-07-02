import type {
  CronSchedule,
  GmibSchedulerAction,
  GmibSchedulerJob,
  GmibSchedulerJobInput,
  PlayerSchedulerAction,
  PlayerSchedulerJob,
  PlayerSchedulerJobInput,
  ScheduleKind,
  SchedulerStatus,
} from '/@common/scheduler';
import { normalizeSelected } from '/@common/scheduler';

import { promisifyAll, promisifyGet, promisifyRun, removeNull } from './db';

import type { NullableOptional } from '/@common/helpers';

type SchedulerScope = 'player' | 'gmib';
type StoredSchedulerJob = PlayerSchedulerJob | GmibSchedulerJob;
type StoredSchedulerJobInput = PlayerSchedulerJobInput | GmibSchedulerJobInput;
type SchedulerJobRow = {
  id: string;
  scope: SchedulerScope;
  kind: ScheduleKind;
  name: string;
  runAt?: string;
  cron?: string;
  enabled: number;
  lastRunAt?: string;
  lastRunKey?: string;
  lastStatus?: SchedulerStatus;
  lastMessage?: string;
  action: PlayerSchedulerAction | GmibSchedulerAction;
  playerId?: number;
  playlistId?: number;
  itemNumber?: number;
  hideOutputOnStop?: number;
  outputAll?: number;
  screenId?: number;
  testId?: string;
  brightness?: number;
  enabledValue?: number;
};

const createId = (): string => crypto.randomUUID();

const parseCron = (value?: string): CronSchedule | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as CronSchedule;
  } catch {
    return undefined;
  }
};

const sanitizeCron = (cron: CronSchedule | undefined): CronSchedule | undefined =>
  cron
    ? {
        minutes: {
          ...cron.minutes,
          selected: normalizeSelected(cron.minutes.selected),
        },
        hours: {
          ...cron.hours,
          selected: normalizeSelected(cron.hours.selected),
        },
        days: {
          ...cron.days,
          selected: normalizeSelected(cron.days.selected),
        },
        months: {
          ...cron.months,
          selected: normalizeSelected(cron.months.selected),
        },
        weekdays: {
          ...cron.weekdays,
          selected: normalizeSelected(cron.weekdays.selected),
        },
      }
    : undefined;

const sanitizeJob = <T extends StoredSchedulerJob>(job: T): T => {
  const { nextRunAt: _, ...storedJob } = job;
  const nextJob = {
    ...storedJob,
    cron: sanitizeCron(storedJob.cron),
  };

  if ('brightness' in nextJob && typeof nextJob.brightness === 'number') {
    return {
      ...nextJob,
      brightness: Math.round(Math.max(Math.min(nextJob.brightness, 100), 0)),
    } as T;
  }

  return nextJob as T;
};

const toBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'number' ? Boolean(value) : undefined;

const toSchedulerJob = (result: NullableOptional): StoredSchedulerJob => {
  const row = removeNull(result as NullableOptional<SchedulerJobRow>);
  const base = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    runAt: row.runAt,
    cron: parseCron(row.cron),
    enabled: Boolean(row.enabled),
    lastRunAt: row.lastRunAt,
    lastRunKey: row.lastRunKey,
    lastStatus: row.lastStatus,
    lastMessage: row.lastMessage,
    action: row.action,
  };

  if (row.scope === 'player') {
    return {
      ...base,
      playerId: row.playerId,
      playlistId: row.playlistId,
      itemNumber: row.itemNumber,
      hideOutputOnStop: toBoolean(row.hideOutputOnStop),
      outputAll: toBoolean(row.outputAll),
    } as PlayerSchedulerJob;
  }

  return {
    ...base,
    screenId: row.screenId,
    testId: row.testId,
    brightness: row.brightness,
    enabledValue: toBoolean(row.enabledValue),
  } as GmibSchedulerJob;
};

const encodeSchedulerJob = (scope: SchedulerScope, job: StoredSchedulerJob) => ({
  $id: job.id,
  $scope: scope,
  $kind: job.kind,
  $name: job.name,
  $runAt: job.runAt ?? null,
  $cron: job.cron ? JSON.stringify(job.cron) : null,
  $enabled: job.enabled ? 1 : 0,
  $lastRunAt: job.lastRunAt ?? null,
  $lastRunKey: job.lastRunKey ?? null,
  $lastStatus: job.lastStatus ?? null,
  $lastMessage: job.lastMessage ?? null,
  $action: job.action,
  $playerId: 'playerId' in job ? job.playerId : null,
  $playlistId: 'playlistId' in job ? (job.playlistId ?? null) : null,
  $itemNumber: 'itemNumber' in job ? (job.itemNumber ?? null) : null,
  $hideOutputOnStop:
    'hideOutputOnStop' in job && job.hideOutputOnStop != null
      ? job.hideOutputOnStop
        ? 1
        : 0
      : null,
  $outputAll: 'outputAll' in job && job.outputAll != null ? (job.outputAll ? 1 : 0) : null,
  $screenId: 'screenId' in job ? (job.screenId ?? null) : null,
  $testId: 'testId' in job ? (job.testId ?? null) : null,
  $brightness: 'brightness' in job ? (job.brightness ?? null) : null,
  $enabledValue:
    'enabledValue' in job && job.enabledValue != null ? (job.enabledValue ? 1 : 0) : null,
});

const getSchedulerJobsByScope = promisifyAll(
  'SELECT * FROM schedulerJob WHERE scope = ? ORDER BY rowid',
  (scope: SchedulerScope) => scope,
  toSchedulerJob,
);

const getSchedulerJobById = promisifyGet(
  'SELECT * FROM schedulerJob WHERE id = ? AND scope = ? LIMIT 1',
  (id: string, scope: SchedulerScope) => [id, scope],
  toSchedulerJob,
);

const insertSchedulerJob = promisifyRun(
  `INSERT INTO schedulerJob (
    id,
    scope,
    kind,
    name,
    runAt,
    cron,
    enabled,
    lastRunAt,
    lastRunKey,
    lastStatus,
    lastMessage,
    action,
    playerId,
    playlistId,
    itemNumber,
    hideOutputOnStop,
    outputAll,
    screenId,
    testId,
    brightness,
    enabledValue
  ) VALUES (
    $id,
    $scope,
    $kind,
    $name,
    $runAt,
    $cron,
    $enabled,
    $lastRunAt,
    $lastRunKey,
    $lastStatus,
    $lastMessage,
    $action,
    $playerId,
    $playlistId,
    $itemNumber,
    $hideOutputOnStop,
    $outputAll,
    $screenId,
    $testId,
    $brightness,
    $enabledValue
  )`,
  encodeSchedulerJob,
);

const updateSchedulerJobRow = promisifyRun(
  `UPDATE schedulerJob
  SET kind = $kind,
      name = $name,
      runAt = $runAt,
      cron = $cron,
      enabled = $enabled,
      lastRunAt = $lastRunAt,
      lastRunKey = $lastRunKey,
      lastStatus = $lastStatus,
      lastMessage = $lastMessage,
      action = $action,
      playerId = $playerId,
      playlistId = $playlistId,
      itemNumber = $itemNumber,
      hideOutputOnStop = $hideOutputOnStop,
      outputAll = $outputAll,
      screenId = $screenId,
      testId = $testId,
      brightness = $brightness,
      enabledValue = $enabledValue
  WHERE id = $id AND scope = $scope`,
  encodeSchedulerJob,
);

const deleteSchedulerJobRow = promisifyRun(
  'DELETE FROM schedulerJob WHERE id = ? AND scope = ?',
  (id: string, scope: SchedulerScope) => [id, scope],
);

export const getStoredPlayerSchedulerJobs = async (
  playerId?: number,
): Promise<PlayerSchedulerJob[]> =>
  (await getSchedulerJobsByScope('player')).filter(
    (job): job is PlayerSchedulerJob =>
      'playerId' in job && (playerId == null || job.playerId === playerId),
  );

export const getStoredGmibSchedulerJobs = async (): Promise<GmibSchedulerJob[]> =>
  (await getSchedulerJobsByScope('gmib')).filter(
    (job): job is GmibSchedulerJob => !('playerId' in job),
  );

export const getStoredPlayerSchedulerJob = async (
  id: string,
): Promise<PlayerSchedulerJob | undefined> => {
  const job = await getSchedulerJobById(id, 'player');
  return job && 'playerId' in job ? job : undefined;
};

export const getStoredGmibSchedulerJob = async (
  id: string,
): Promise<GmibSchedulerJob | undefined> => {
  const job = await getSchedulerJobById(id, 'gmib');
  return job && !('playerId' in job) ? job : undefined;
};

export function createStoredSchedulerJob(
  scope: 'player',
  input: PlayerSchedulerJobInput,
): Promise<PlayerSchedulerJob>;
export function createStoredSchedulerJob(
  scope: 'gmib',
  input: GmibSchedulerJobInput,
): Promise<GmibSchedulerJob>;
export async function createStoredSchedulerJob(
  scope: SchedulerScope,
  input: StoredSchedulerJobInput,
): Promise<StoredSchedulerJob> {
  const job = sanitizeJob({
    ...input,
    id: input.id ?? createId(),
    enabled: input.enabled,
    lastStatus: 'idle',
  });
  await insertSchedulerJob(scope, job);
  return job;
}

export function updateStoredSchedulerJob(
  scope: 'player',
  id: string,
  input: PlayerSchedulerJobInput,
): Promise<PlayerSchedulerJob | undefined>;
export function updateStoredSchedulerJob(
  scope: 'gmib',
  id: string,
  input: GmibSchedulerJobInput,
): Promise<GmibSchedulerJob | undefined>;
export async function updateStoredSchedulerJob(
  scope: SchedulerScope,
  id: string,
  input: StoredSchedulerJobInput,
): Promise<StoredSchedulerJob | undefined> {
  const current = await getSchedulerJobById(id, scope);
  if (!current) return undefined;

  const scheduleChanged =
    input.kind !== current.kind ||
    input.runAt !== current.runAt ||
    JSON.stringify(input.cron) !== JSON.stringify(current.cron);
  const updated = sanitizeJob({
    ...current,
    ...input,
    id,
    lastRunAt: scheduleChanged ? undefined : current.lastRunAt,
    lastRunKey: scheduleChanged ? undefined : current.lastRunKey,
    lastStatus: scheduleChanged ? 'idle' : current.lastStatus,
    lastMessage: scheduleChanged ? undefined : current.lastMessage,
  });

  const { changes } = await updateSchedulerJobRow(scope, updated);
  return changes ? updated : undefined;
}

export const updateStoredSchedulerJobResult = async <T extends StoredSchedulerJob>(
  scope: SchedulerScope,
  job: T,
  result: Pick<T, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> &
    Partial<Pick<T, 'enabled'>>,
): Promise<void> => {
  await updateSchedulerJobRow(scope, sanitizeJob({ ...job, ...result }));
};

export const deleteStoredSchedulerJob = async (
  scope: SchedulerScope,
  id: string,
): Promise<boolean> => {
  const { changes } = await deleteSchedulerJobRow(id, scope);
  return changes > 0;
};
