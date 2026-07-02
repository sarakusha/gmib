import debugFactory from 'debug';

import type { PlayerSchedulerJob, PlayerSchedulerJobInput } from '/@common/scheduler';
import { getMinuteKey, getNextRunAt, matchesCron } from '/@common/scheduler';

import { dbReady } from './db';
import { setPlayerOutputWindowsVisibility } from './openHandler';
import { getPlaylist, getPlaylistItems } from './playlist';
import { openPlayer } from './playerWindow';
import {
  createStoredSchedulerJob,
  deleteStoredSchedulerJob,
  getStoredPlayerSchedulerJob,
  getStoredPlayerSchedulerJobs,
  updateStoredSchedulerJob,
  updateStoredSchedulerJobResult,
} from './schedulerStore';
import { getPlayer, updatePlayer } from './screen';
import { broadcast } from './server';
import { findPlayerWindow } from './windowStore';

import type { Player } from '/@common/video';

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

type PlayerRuntimeOptions = {
  openHidden?: boolean;
  restart?: boolean;
};

const sendPlayerToRuntime = async (
  playerId: number,
  options: Pick<PlayerRuntimeOptions, 'restart'> = {},
): Promise<Player | undefined> => {
  const player = await getPlayer(playerId);
  if (!player) return undefined;
  const win = findPlayerWindow(player.id);
  if (win) win.webContents.send('player', player, { restart: options.restart });
  broadcast({ event: 'player', all: true });
  return player;
};

const updatePlayerRuntime = async (
  player: Player,
  options: PlayerRuntimeOptions = {},
): Promise<void> => {
  await updatePlayer(player);
  const updatedPlayer = await sendPlayerToRuntime(player.id, options);
  if (options.openHidden && !findPlayerWindow(player.id) && updatedPlayer) {
    await openPlayer(player.id, { hidden: true });
  }
};

const runJob = async (job: PlayerSchedulerJob): Promise<void> => {
  const player = await getPlayer(job.playerId);
  if (!player) throw new Error(`Плеер ${job.playerId} не найден`);

  switch (job.action) {
    case 'load-playlist': {
      if (job.playlistId == null) throw new Error('Плейлист не выбран');
      const playlist = await getPlaylist(job.playlistId);
      if (!playlist) throw new Error(`Плейлист ${job.playlistId} не найден`);
      const items = await getPlaylistItems(job.playlistId);
      if (items.length === 0) throw new Error(`Плейлист "${playlist.name}" пуст`);
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
        { ...player, autoPlay: !player.autoPlay },
        { openHidden: !player.autoPlay },
      );
      break;
    case 'play':
      await updatePlayerRuntime({ ...player, autoPlay: true }, { openHidden: true });
      break;
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
    case 'next':
      await updatePlayerRuntime(
        {
          ...player,
          current: await getNextItem(player.playlistId, player.current),
          autoPlay: true,
        },
        { openHidden: true },
      );
      break;
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
      await updatePlayerRuntime(
        { ...player, current: item.id, autoPlay: true },
        { openHidden: true },
      );
      break;
    }
    default:
      break;
  }
};

const executeJob = async (
  job: PlayerSchedulerJob,
  options: { disableOnce: boolean },
): Promise<PlayerSchedulerJob> => {
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

export const runSchedulerJob = async (id: string): Promise<PlayerSchedulerJob | undefined> => {
  const job = await getStoredPlayerSchedulerJob(id);
  if (!job) return undefined;
  return executeJob(job, { disableOnce: false });
};

const executeDueJobs = async (): Promise<void> => {
  const now = new Date();
  const minuteKey = getMinuteKey(now);
  const dueJobs = (await getStoredPlayerSchedulerJobs()).filter(job => {
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

export const startPlayerScheduler = (): void => {
  if (timer) return;
  void dbReady.then(() => {
    timer = setInterval(() => {
      void executeDueJobs();
    }, 1000);
    void executeDueJobs();
  });
};
