import debugFactory from 'debug';
import Store from 'electron-store';

import type { PlayerSchedulerJob, PlayerSchedulerJobInput } from '/@common/scheduler';
import { getMinuteKey, getNextRunAt, matchesCron, normalizeSelected } from '/@common/scheduler';

import { dbReady } from './db';
import { getPlaylist, getPlaylistItems } from './playlist';
import { openPlayer } from './playerWindow';
import { getPlayer, updatePlayer } from './screen';
import { broadcast } from './server';
import { findPlayerWindow } from './windowStore';

import type { Player } from '/@common/video';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playerScheduler`);

type SchedulerStore = {
  jobs: PlayerSchedulerJob[];
};

const store = new Store<SchedulerStore>({
  name: `${import.meta.env.VITE_APP_NAME}-player-scheduler`,
  defaults: {
    jobs: [],
  },
  watch: true,
});

const createId = (): string => crypto.randomUUID();

const sanitizeJob = (job: PlayerSchedulerJob): PlayerSchedulerJob => {
  const { nextRunAt: _, ...storedJob } = job;
  return {
    ...storedJob,
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

const withNextRunAt = (job: PlayerSchedulerJob): PlayerSchedulerJob => ({
  ...job,
  nextRunAt: getNextRunAt(job),
});

const getStoredJobs = (): PlayerSchedulerJob[] => store.get('jobs', []);

const setStoredJobs = (jobs: PlayerSchedulerJob[]): void => {
  store.set('jobs', jobs.map(sanitizeJob));
};

export const getSchedulerJobs = (playerId?: number): PlayerSchedulerJob[] =>
  getStoredJobs()
    .filter(job => playerId == null || job.playerId === playerId)
    .map(withNextRunAt);

export const createSchedulerJob = (input: PlayerSchedulerJobInput): PlayerSchedulerJob => {
  const job = sanitizeJob({
    ...input,
    id: input.id ?? createId(),
    enabled: input.enabled,
    lastStatus: 'idle',
  });
  setStoredJobs([...getStoredJobs(), job]);
  return withNextRunAt(job);
};

export const updateSchedulerJob = (
  id: string,
  input: PlayerSchedulerJobInput,
): PlayerSchedulerJob | undefined => {
  let updated: PlayerSchedulerJob | undefined;
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

export const deleteSchedulerJob = (id: string): boolean => {
  const jobs = getStoredJobs();
  const nextJobs = jobs.filter(job => job.id !== id);
  if (nextJobs.length === jobs.length) return false;
  setStoredJobs(nextJobs);
  return true;
};

const setJobResult = (
  job: PlayerSchedulerJob,
  result: Pick<PlayerSchedulerJob, 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage'> &
    Partial<Pick<PlayerSchedulerJob, 'enabled'>>,
): void => {
  setStoredJobs(
    getStoredJobs().map(item =>
      item.id === job.id
        ? {
            ...item,
            ...result,
          }
        : item,
    ),
  );
};

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

const sendPlayerToRuntime = async (playerId: number): Promise<Player | undefined> => {
  const player = await getPlayer(playerId);
  if (!player) return undefined;
  const win = findPlayerWindow(player.id);
  if (win) win.webContents.send('player', player);
  broadcast({ event: 'player', all: true });
  return player;
};

const updatePlayerRuntime = async (player: Player, openHidden = false): Promise<void> => {
  await updatePlayer(player);
  const updatedPlayer = await sendPlayerToRuntime(player.id);
  if (openHidden && !findPlayerWindow(player.id) && updatedPlayer) {
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
        true,
      );
      break;
    }
    case 'toggle-play':
      await updatePlayerRuntime({ ...player, autoPlay: !player.autoPlay }, !player.autoPlay);
      break;
    case 'play':
      await updatePlayerRuntime({ ...player, autoPlay: true }, true);
      break;
    case 'stop': {
      await updatePlayerRuntime({
        ...player,
        current: undefined,
        autoPlay: false,
      });
      const win = findPlayerWindow(player.id);
      if (win) win.webContents.send('stop', player.id);
      break;
    }
    case 'next':
      await updatePlayerRuntime(
        {
          ...player,
          current: await getNextItem(player.playlistId, player.current),
        },
        true,
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
      await updatePlayerRuntime({ ...player, current: item.id, autoPlay: true }, true);
      break;
    }
    default:
      break;
  }
};

const executeDueJobs = async (): Promise<void> => {
  const now = new Date();
  const minuteKey = getMinuteKey(now);
  const dueJobs = getStoredJobs().filter(job => {
    if (!job.enabled) return false;
    if (job.kind === 'once') {
      if (!job.runAt || job.lastRunAt) return false;
      return new Date(job.runAt).getTime() <= now.getTime();
    }
    return Boolean(job.cron && job.lastRunKey !== minuteKey && matchesCron(job.cron, now));
  });

  for (const job of dueJobs) {
    const lastRunAt = now.toISOString();
    try {
      await runJob(job);
      const nextJob = {
        ...job,
        lastRunAt,
        lastRunKey: minuteKey,
        lastStatus: 'success' as const,
        lastMessage: `Задание "${job.name}" выполнено`,
        ...(job.kind === 'once' ? { enabled: false } : {}),
      };
      setJobResult(job, nextJob);
      notifyJobResult(nextJob);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug(`error while run job ${job.name}: ${message}`);
      const nextJob = {
        ...job,
        lastRunAt,
        lastRunKey: minuteKey,
        lastStatus: 'error' as const,
        lastMessage: message,
        ...(job.kind === 'once' ? { enabled: false } : {}),
      };
      setJobResult(job, nextJob);
      notifyJobResult(nextJob);
    }
  }
};

let timer: NodeJS.Timeout | undefined;

export const startPlayerScheduler = (): void => {
  if (timer) return;
  debug(`scheduler store: ${store.path}`);
  void dbReady.then(() => {
    timer = setInterval(() => {
      void executeDueJobs();
    }, 1000);
    void executeDueJobs();
  });
};
