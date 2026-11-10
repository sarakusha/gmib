import { isFinitePlaybackActive } from './finitePlaybackRegistry';
import { startFinitePlaylist } from './finitePlaylistPlayback';
import debugFactory from 'debug';

import type { PlayerSchedulerJob, PlayerSchedulerJobInput } from '/@common/scheduler';
import { getNextRunAt, getRunKey, isSchedulerJobExpired } from '/@common/scheduler';

import { setPlayerOutputWindowsVisibility } from './openHandler';
import { getPlaylist, getPlaylistItems } from './playlist';
import { updatePlayerRuntime } from './playerRuntime';
import { checkPlayerOutput } from './playerOutputHealth';
import {
  claimExpiredPlayerSchedulerJob,
  createStoredSchedulerJob,
  deleteStoredSchedulerJob,
  getStoredPlayerSchedulerJob,
  getStoredPlayerSchedulerJobs,
  updateStoredSchedulerJob,
  updateStoredSchedulerJobResult,
} from './schedulerStore';
import { getPlayer } from './screen';
import { enqueueSchedulerJob } from './schedulerQueue';
import { broadcast } from './server';
import { findPlayerWindow } from './windowStore';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playerScheduler`);

const withNextRunAt = (job: PlayerSchedulerJob): PlayerSchedulerJob => ({
  ...job,
  nextRunAt: getNextRunAt(job),
});

export const getSchedulerJobs = async (playerId?: number): Promise<PlayerSchedulerJob[]> =>
  (await getStoredPlayerSchedulerJobs(playerId)).map(withNextRunAt);

export const createSchedulerJob = async (
  input: PlayerSchedulerJobInput,
): Promise<PlayerSchedulerJob> => withNextRunAt(await createStoredSchedulerJob('player', input));

export const updateSchedulerJob = (
  id: string,
  input: PlayerSchedulerJobInput,
): Promise<PlayerSchedulerJob | undefined> =>
  updateStoredSchedulerJob('player', id, input).then(job => job && withNextRunAt(job));

export const deleteSchedulerJob = (id: string): Promise<boolean> =>
  deleteStoredSchedulerJob('player', id);

const setJobResult = (
  job: PlayerSchedulerJob,
  result: Pick<PlayerSchedulerJob, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> &
    Partial<Pick<PlayerSchedulerJob, 'enabled'>>,
): Promise<void> => updateStoredSchedulerJobResult('player', job, result);

const notifyJobResult = (job: PlayerSchedulerJob): void => {
  broadcast({
    event: 'scheduler',
    data: [
      job.playerId,
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

const getNextItem = async (
  playlistId?: number | null,
  current?: string,
): Promise<string | undefined> => {
  if (!playlistId) return undefined;
  const items = await getPlaylistItems(playlistId);
  if (items.length === 0) return undefined;
  if (!current) return items[0]?.id;
  const index = items.findIndex(item => item.id === current);
  return items[(index + 1) % items.length]?.id;
};

class SchedulerExpiryError extends Error {}

const runJob = async (
  job: PlayerSchedulerJob,
  enforceExpiry = true,
): Promise<string | undefined> => {
  const checkDeadline = (): void => {
    if (enforceExpiry && isSchedulerJobExpired(job))
      throw new SchedulerExpiryError('Срок действия задания истёк');
  };
  const player = await getPlayer(job.playerId);
  if (!player) throw new Error(`Плеер ${job.playerId} не найден`);
  checkDeadline();

  switch (job.action) {
    case 'play-playlist-times': {
      if (job.playlistId == null || job.repeatCount == null || !job.completionAction)
        throw new Error('Не заданы параметры конечного воспроизведения');
      await startFinitePlaylist(
        player,
        job.playlistId,
        job.repeatCount,
        job.completionAction,
        checkDeadline,
      );
      return `Запущено проигрывание плейлиста ${job.repeatCount} раз`;
    }
    case 'load-playlist': {
      if (job.playlistId == null) throw new Error('Плейлист не выбран');
      const playlist = await getPlaylist(job.playlistId);
      if (!playlist) throw new Error(`Плейлист ${job.playlistId} не найден`);
      const items = await getPlaylistItems(job.playlistId);
      if (items.length === 0) throw new Error(`Плейлист "${playlist.name}" пуст`);
      checkDeadline();
      await updatePlayerRuntime(
        {
          ...player,
          playlistId: job.playlistId,
          current: undefined,
          autoPlay: true,
        },
        { openHidden: true, restart: true },
      );
      break;
    }
    case 'toggle-play':
      await updatePlayerRuntime(
        { ...player, autoPlay: !(player.autoPlay || isFinitePlaybackActive(player.id)) },
        { openHidden: !(player.autoPlay || isFinitePlaybackActive(player.id)) },
      );
      break;
    case 'play':
      await updatePlayerRuntime({ ...player, autoPlay: true }, { openHidden: true });
      return checkPlayerOutput(player.id);
    case 'stop': {
      await updatePlayerRuntime({
        ...player,
        current: undefined,
        autoPlay: false,
      });
      const win = findPlayerWindow(player.id);
      if (win) win.webContents.send('stop', player.id);
      if (job.hideOutputOnStop) setPlayerOutputWindowsVisibility(false, player.id);
      break;
    }
    case 'hide-output': {
      setPlayerOutputWindowsVisibility(false, job.outputAll ? undefined : player.id);
      break;
    }
    case 'show-output': {
      setPlayerOutputWindowsVisibility(true, job.outputAll ? undefined : player.id);
      break;
    }
    case 'next': {
      const current = await getNextItem(player.playlistId, player.current);
      checkDeadline();
      await updatePlayerRuntime(
        {
          ...player,
          current,
          autoPlay: true,
        },
        { openHidden: true },
      );
      break;
    }
    case 'play-item': {
      const playlistId = player.playlistId;
      if (!playlistId) throw new Error('Текущий плейлист не выбран');
      const playlist = await getPlaylist(playlistId);
      const items = await getPlaylistItems(playlistId);
      const item = items[(job.itemNumber ?? 1) - 1];
      if (!item) {
        throw new Error(
          `В плейлисте "${playlist?.name ?? playlistId}" нет ролика ${job.itemNumber ?? 1}`,
        );
      }
      checkDeadline();
      await updatePlayerRuntime(
        { ...player, current: item.id, autoPlay: true },
        { openHidden: true },
      );
      break;
    }
    default:
      break;
  }
  return undefined;
};

const expireJob = async (job: PlayerSchedulerJob): Promise<PlayerSchedulerJob> => {
  if (!(await claimExpiredPlayerSchedulerJob(job))) {
    return withNextRunAt((await getStoredPlayerSchedulerJob(job.id)) ?? { ...job, enabled: false });
  }
  const result: PlayerSchedulerJob = {
    ...job,
    enabled: false,
    lastStatus: 'success',
    lastMessage: 'Срок действия задания истёк',
  };
  try {
    if (job.stopOnExpiry) {
      await runJob({ ...job, action: 'stop', hideOutputOnStop: false }, false);
      result.lastMessage = 'Срок действия задания истёк; воспроизведение остановлено';
    }
  } catch (error) {
    result.lastStatus = 'error';
    result.lastMessage = `Срок действия задания истёк; не удалось остановить воспроизведение: ${error instanceof Error ? error.message : String(error)}`;
  }
  // The claim already disabled this occurrence. Do not overwrite a concurrent user edit.
  await setJobResult(job, {
    lastRunAt: result.lastRunAt,
    lastRunKey: result.lastRunKey,
    lastStatus: result.lastStatus,
    lastMessage: result.lastMessage,
  });
  notifyJobResult(result);
  return withNextRunAt(result);
};

export const executePlayerSchedulerJob = async (
  queuedJob: PlayerSchedulerJob,
  options: { disableOnce: boolean; expiryOnly?: boolean },
): Promise<PlayerSchedulerJob | undefined> => {
  // Jobs may wait in the shared queue: use the latest enablement, deadline and parameters.
  const job = await getStoredPlayerSchedulerJob(queuedJob.id);
  if (!job) return undefined;
  if (!job.enabled) return withNextRunAt(job);
  const now = new Date();
  if (isSchedulerJobExpired(job, now)) return expireJob(job);
  if (options.expiryOnly) return withNextRunAt(job);
  if (
    options.disableOnce &&
    (job.kind !== queuedJob.kind ||
      job.runAt !== queuedJob.runAt ||
      JSON.stringify(job.cron) !== JSON.stringify(queuedJob.cron))
  )
    return withNextRunAt(job);
  const lastRunAt = now.toISOString();
  const lastRunKey = getRunKey(now);
  try {
    const message = await runJob(job);
    const nextJob = {
      ...job,
      lastRunAt,
      lastRunKey,
      lastStatus: 'success' as const,
      lastMessage: message ?? `Задание "${job.name}" выполнено`,
      ...(options.disableOnce && job.kind === 'once' ? { enabled: false } : {}),
    };
    await setJobResult(job, nextJob);
    notifyJobResult(nextJob);
    return withNextRunAt(nextJob);
  } catch (error) {
    if (error instanceof SchedulerExpiryError) {
      const current = await getStoredPlayerSchedulerJob(job.id);
      return current?.enabled && isSchedulerJobExpired(current)
        ? expireJob(current)
        : current && withNextRunAt(current);
    }
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

export const runSchedulerJob = async (id: string): Promise<PlayerSchedulerJob | undefined> => {
  const job = await getStoredPlayerSchedulerJob(id);
  if (!job) return undefined;
  return enqueueSchedulerJob(() => executePlayerSchedulerJob(job, { disableOnce: false }));
};
