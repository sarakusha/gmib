import path from 'node:path';

import { app, ipcMain } from 'electron';
import debugFactory from 'debug';

import {
  isPlaybackEventForPlayer,
  isPlaybackRetryMediaId,
  type PlaybackEvent,
  type PlaybackStatusSnapshot,
} from '/@common/playback';
import { isPlayer } from '/@common/WindowParams';

import localConfig from './localConfig';
import { PlaybackEventLog } from './playbackEventLog';
import { broadcastPlaybackRetry } from './playbackRetry';
import { PlaybackStatusStore } from './playbackStatus';
import { broadcast } from './server';
import { findManagedWindow, findParamsByWebContentsId, getPlayerParams } from './windowStore';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playbackEvents`);
const statusStore = new PlaybackStatusStore();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const snapshot = (): PlaybackStatusSnapshot => ({
  ...statusStore.snapshot(),
});

const emitStatus = (): void => {
  const status = snapshot();
  broadcast({ event: 'playback:status', data: [0, status], all: true });
};

const updateStatus = (event: PlaybackEvent): void => {
  if (statusStore.apply(event)) emitStatus();
};

export const getPlaybackStatus = (): PlaybackStatusSnapshot => snapshot();

export const retryPlayback = (mediaId: unknown): boolean => {
  if (!isPlaybackRetryMediaId(mediaId)) return false;
  if (statusStore.clearMedia(mediaId)) emitStatus();
  broadcastPlaybackRetry(mediaId, getPlayerParams(), findManagedWindow);
  return true;
};

const clearPlayerIssues = (playerId: number): void => {
  if (statusStore.clearPlayer(playerId)) emitStatus();
};

const statusLifecycleSenders = new WeakSet<Electron.WebContents>();

const trackPlayerStatusLifecycle = (sender: Electron.WebContents, playerId: number): void => {
  if (statusLifecycleSenders.has(sender)) return;
  statusLifecycleSenders.add(sender);
  sender.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) clearPlayerIssues(playerId);
  });
  sender.once('destroyed', () => clearPlayerIssues(playerId));
};

const lastFailureLog = new Map<string, number>();
const logFailure = (action: string, error: unknown): void => {
  const now = Date.now();
  if (now - (lastFailureLog.get(action) ?? 0) < 60_000) return;
  lastFailureLog.set(action, now);
  debug(`${action}: ${error instanceof Error ? error.message : String(error)}`);
};

void app.whenReady().then(() => {
  const eventLog = new PlaybackEventLog({
    directory: path.join(app.getPath('logs'), 'playback'),
    retentionDays: () => localConfig.get('playbackLogRetentionDays'),
    onMaintenanceError: error => logFailure('playback log cleanup failed', error),
  });

  const cleanup = (): void => {
    void eventLog.cleanup().catch(error => logFailure('playback log cleanup failed', error));
  };
  cleanup();
  const scheduleCleanup = (): void => {
    const now = new Date();
    const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const cleanupTimer = setTimeout(
      () => {
        cleanup();
        scheduleCleanup();
      },
      Math.min(MS_PER_DAY, Math.max(1, nextUtcDay - now.getTime())),
    );
    cleanupTimer.unref();
  };
  scheduleCleanup();
  localConfig.onDidChange('playbackLogRetentionDays', cleanup);

  ipcMain.on('playback:event', (ipcEvent, value: unknown) => {
    const params = findParamsByWebContentsId(ipcEvent.sender.id);
    if (
      !isPlayer(params) ||
      params.host !== 'localhost' ||
      !isPlaybackEventForPlayer(value, params.playerId)
    ) {
      debug('rejected playback event with invalid sender attribution');
      return;
    }
    trackPlayerStatusLifecycle(ipcEvent.sender, params.playerId);
    updateStatus(value);
    void eventLog.append(value).catch(error => logFailure('playback event write failed', error));
  });
});
