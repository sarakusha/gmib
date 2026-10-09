import path from 'node:path';

import { app, ipcMain } from 'electron';
import debugFactory from 'debug';

import {
  isPlaybackEventForPlayer,
  isPlaybackRetryMediaId,
  isPlaybackStatisticsEvent,
  type PlaybackEvent,
  type PlaybackStatusSnapshot,
} from '/@common/playback';
import { isPlayer } from '/@common/WindowParams';

import { PlaybackOutputEvidenceTracker } from './playbackOutputEvidence';
import { getPlaybackOutputs, onPlaybackOutputsChanged } from './playbackOutputState';
import localConfig from './localConfig';
import { onBeforeDatabaseClose } from './db';
import { cleanupLegacyPlaybackLogs } from './playbackEventLog';
import { getPlaybackStatisticsStore } from './playbackStatisticsDatabase';
import { broadcastPlaybackRetry } from './playbackRetry';
import { PlaybackStatusStore } from './playbackStatus';
import { broadcast } from './server';
import { findManagedWindow, findParamsByWebContentsId, getPlayerParams } from './windowStore';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:playbackEvents`);
const statusStore = new PlaybackStatusStore();
const outputEvidence = new PlaybackOutputEvidenceTracker(getPlaybackOutputs);
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
  outputEvidence.clearPlayer(playerId);
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

let stopping = false;
let stopRecording: (() => Promise<void>) | undefined;
onBeforeDatabaseClose(() => {
  stopping = true;
  return stopRecording?.();
});

void app.whenReady().then(() => {
  if (stopping) return;
  const store = getPlaybackStatisticsStore();

  const append = (event: PlaybackEvent): void => {
    if (stopping || !isPlaybackStatisticsEvent(event)) return;
    void store.append(event).catch(error => logFailure('playback event write failed', error));
  };
  const offOutputsChanged = onPlaybackOutputsChanged((playerId, outputs, at) => {
    outputEvidence.changed(playerId, outputs, at).forEach(append);
  });

  let legacyCleanup = Promise.resolve();
  const cleanup = (): void => {
    if (stopping) return;
    void store.cleanup().catch(error => logFailure('playback database cleanup failed', error));
    // Existing files expire normally but are never read for statistics or imported.
    legacyCleanup = legacyCleanup
      .then(() =>
        cleanupLegacyPlaybackLogs(
          path.join(app.getPath('logs'), 'playback'),
          localConfig.get('playbackLogRetentionDays'),
        ),
      )
      .catch(error => logFailure('legacy playback log cleanup failed', error));
  };
  cleanup();
  let cleanupTimer: NodeJS.Timeout;
  const scheduleCleanup = (): void => {
    const now = new Date();
    const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    cleanupTimer = setTimeout(
      () => {
        cleanup();
        scheduleCleanup();
      },
      Math.min(MS_PER_DAY, Math.max(1, nextUtcDay - now.getTime())),
    );
    cleanupTimer.unref();
  };
  scheduleCleanup();
  const offRetentionChanged = localConfig.onDidChange('playbackLogRetentionDays', cleanup);

  const onPlaybackEvent = (ipcEvent: Electron.IpcMainEvent, value: unknown): void => {
    if (stopping) return;
    const params = findParamsByWebContentsId(ipcEvent.sender.id);
    if (
      !isPlayer(params) ||
      params.host !== 'localhost' ||
      ipcEvent.senderFrame !== ipcEvent.sender.mainFrame ||
      !isPlaybackEventForPlayer(value, params.playerId)
    ) {
      debug('rejected playback event with invalid sender attribution');
      return;
    }
    trackPlayerStatusLifecycle(ipcEvent.sender, params.playerId);
    updateStatus(value);
    outputEvidence.process(value).forEach(append);
  };
  ipcMain.on('playback:event', onPlaybackEvent);
  stopRecording = () => {
    ipcMain.removeListener('playback:event', onPlaybackEvent);
    offOutputsChanged();
    offRetentionChanged();
    clearTimeout(cleanupTimer);
    return legacyCleanup;
  };
});
