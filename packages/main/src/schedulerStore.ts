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
  priority: number;
  lastRunAt?: string;
  lastRunKey?: string;
  lastStatus?: SchedulerStatus;
  lastMessage?: string;
  action: PlayerSchedulerAction | GmibSchedulerAction;
  playerId?: number;
  playlistId?: number;
  itemNumber?: number;
  repeatCount?: number;
  completionAction?: 'stop' | 'hide';
  expiresAt?: string;
  stopOnExpiry?: number;
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
    const cron = JSON.parse(value) as Partial<CronSchedule>;
    if (!cron.minutes || !cron.hours || !cron.days || !cron.months || !cron.weekdays) {
      return undefined;
    }
    return {
      ...cron,
      seconds: cron.seconds ?? { mode: 'select', every: 1, selected: [0] },
    } as CronSchedule;
  } catch {
    return undefined;
  }
};

const sanitizeCron = (cron: CronSchedule | undefined): CronSchedule | undefined =>
  cron
    ? {
        seconds: {
          ...(cron.seconds ?? { mode: 'select', every: 1, selected: [0] }),
          selected: normalizeSelected(cron.seconds?.selected ?? [0]),
        },
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

const isFinitePlaylistJob = (job: StoredSchedulerJob): job is PlayerSchedulerJob =>
  job.action === 'play-playlist-times';

const sanitizeJob = <T extends StoredSchedulerJob>(job: T): T => {
  if (isFinitePlaylistJob(job)) {
    const finite = job;
    if (
      !Number.isSafeInteger(finite.playlistId) ||
      finite.playlistId! < 1 ||
      !Number.isSafeInteger(finite.repeatCount) ||
      finite.repeatCount! < 1 ||
      !['stop', 'hide'].includes(finite.completionAction ?? '')
    )
      throw new TypeError(
        'Укажите плейлист, целое число повторов больше нуля и действие завершения',
      );
  }
  if ('playerId' in job) {
    if (job.expiresAt != null && typeof job.expiresAt !== 'string')
      throw new TypeError('Некорректная дата окончания задания');
    if (job.stopOnExpiry != null && typeof job.stopOnExpiry !== 'boolean')
      throw new TypeError('Некорректный параметр остановки по окончании');
    if (job.expiresAt && (job.kind !== 'cron' || !Number.isFinite(Date.parse(job.expiresAt))))
      throw new TypeError('Укажите корректную дату окончания повторяющегося задания');
    if (job.stopOnExpiry && !job.expiresAt)
      throw new TypeError('Для остановки по окончании укажите дату окончания задания');
  }
  const { nextRunAt: _, ...storedJob } = job;
  const nextJob = {
    ...storedJob,
    ...('playerId' in job
      ? {
          expiresAt: job.expiresAt || undefined,
          stopOnExpiry: Boolean(job.expiresAt && job.stopOnExpiry),
        }
      : {}),
    priority: Number.isFinite(storedJob.priority) ? Math.trunc(storedJob.priority) : 0,
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
    priority: row.priority ?? 0,
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
      repeatCount: row.repeatCount,
      completionAction: row.completionAction,
      expiresAt: row.expiresAt,
      stopOnExpiry: toBoolean(row.stopOnExpiry),
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
  $priority: job.priority,
  $lastRunAt: job.lastRunAt ?? null,
  $lastRunKey: job.lastRunKey ?? null,
  $lastStatus: job.lastStatus ?? null,
  $lastMessage: job.lastMessage ?? null,
  $action: job.action,
  $playerId: 'playerId' in job ? job.playerId : null,
  $playlistId: 'playlistId' in job ? (job.playlistId ?? null) : null,
  $repeatCount: 'repeatCount' in job ? (job.repeatCount ?? null) : null,
  $completionAction: 'completionAction' in job ? (job.completionAction ?? null) : null,
  $expiresAt: 'expiresAt' in job ? (job.expiresAt ?? null) : null,
  $stopOnExpiry: 'stopOnExpiry' in job ? (job.stopOnExpiry ? 1 : 0) : null,
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
    priority,
    lastRunAt,
    lastRunKey,
    lastStatus,
    lastMessage,
    action,
    playerId,
    playlistId,
    itemNumber,
    repeatCount,
    completionAction,
    expiresAt,
    stopOnExpiry,
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
    $priority,
    $lastRunAt,
    $lastRunKey,
    $lastStatus,
    $lastMessage,
    $action,
    $playerId,
    $playlistId,
    $itemNumber,
    $repeatCount,
    $completionAction,
    $expiresAt,
    $stopOnExpiry,
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
      priority = $priority,
      lastRunAt = $lastRunAt,
      lastRunKey = $lastRunKey,
      lastStatus = $lastStatus,
      lastMessage = $lastMessage,
      action = $action,
      playerId = $playerId,
      playlistId = $playlistId,
      itemNumber = $itemNumber,
      repeatCount = $repeatCount,
      completionAction = $completionAction,
      expiresAt = $expiresAt,
      stopOnExpiry = $stopOnExpiry,
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
  // Runtime completion must never overwrite concurrent edits to the task or re-enable it.
  await updateSchedulerJobResultRow(scope, job.id, result);
};

export const deleteStoredSchedulerJob = async (
  scope: SchedulerScope,
  id: string,
): Promise<boolean> => {
  const { changes } = await deleteSchedulerJobRow(id, scope);
  return changes > 0;
};

const updateSchedulerJobResultRow = promisifyRun(
  `UPDATE schedulerJob SET
    lastRunAt = $lastRunAt, lastRunKey = $lastRunKey,
    lastStatus = $lastStatus, lastMessage = $lastMessage,
    enabled = CASE WHEN $disable = 1 THEN 0 ELSE enabled END
  WHERE id = $id AND scope = $scope`,
  (
    scope: SchedulerScope,
    id: string,
    result: Pick<StoredSchedulerJob, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> & {
      enabled?: boolean;
    },
  ) => ({
    $scope: scope,
    $id: id,
    $lastRunAt: result.lastRunAt ?? null,
    $lastRunKey: result.lastRunKey ?? null,
    $lastStatus: result.lastStatus ?? null,
    $lastMessage: result.lastMessage ?? null,
    $disable: result.enabled === false ? 1 : 0,
  }),
);

const claimExpiredJob = promisifyRun(
  `UPDATE schedulerJob SET enabled = 0
   WHERE id = $id AND scope = 'player' AND enabled = 1 AND kind = 'cron'
     AND expiresAt = $expiresAt AND COALESCE(stopOnExpiry, 0) = $stopOnExpiry`,
  (job: PlayerSchedulerJob) => ({
    $id: job.id,
    $expiresAt: job.expiresAt ?? null,
    $stopOnExpiry: job.stopOnExpiry ? 1 : 0,
  }),
);

/** Claim expiry before side effects so other queued occurrences cannot stop the player twice. */
export const claimExpiredPlayerSchedulerJob = async (job: PlayerSchedulerJob): Promise<boolean> =>
  (await claimExpiredJob(job)).changes > 0;
