import { app, ipcMain } from 'electron';
import debugFactory from 'debug';

import {
  isPlayerOutputHealth,
  OUTPUT_HEALTH_CHECK_INTERVAL,
  type OutputHealthProbe,
  type PlayerOutputHealth,
} from '/@common/outputHealth';

import type { ManagedWindow } from './managedWindow';
import { getPlayerMappingsForPlayer } from './playerMapping';
import { getPlayer } from './screen';
import { getPlaylistItems } from './playlist';
import {
  closePlayerOutputWindows,
  getUnavailablePlayerOutputIds,
  reconcilePlayerOutputWindows,
} from './openHandler';
import { hasConfirmedOutput, OutputHealthPolicy } from './outputHealthPolicy';
import { recoverPlayerRenderer } from './recoverPlayerRenderer';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:outputHealth`);
type Monitor = {
  window: ManagedWindow;
  playerId: number;
  policy: OutputHealthPolicy;
  poll: () => Promise<void>;
  expectedIds: number[];
  hidden: boolean;
  unavailable: boolean;
  requestId: number;
  pending: Set<number>;
  lastHealth?: PlayerOutputHealth;
  lastHealthAt: number;
  listeners: Set<(report: PlayerOutputHealth) => void>;
};
const monitors = new Map<number, Monitor>();
let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

const bounded = async <T>(operation: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Output metadata check timed out')), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

ipcMain.on('player-output:health', (event, report: unknown) => {
  const monitor = monitors.get(event.sender.id);
  if (!monitor || event.senderFrame !== event.sender.mainFrame || !isPlayerOutputHealth(report))
    return;
  if (!monitor.pending.delete(report.requestId)) return;
  if (monitor.lastHealth && report.requestId <= monitor.lastHealth.requestId) return;
  monitor.lastHealth = report;
  monitor.lastHealthAt = performance.now();
  monitor.policy.report(report, monitor.lastHealthAt);
  if (report.recovery) debug(`player ${monitor.playerId}: ${report.recovery}`);
  monitor.listeners.forEach(listener => listener(report));
});

/** Supervise each local player independently; never restart the whole application. */
export const watchPlayerOutput = (window: ManagedWindow, playerId: number, url: string): void => {
  const { webContents } = window;
  if (monitors.has(webContents.id)) return;
  let polling = false;
  let disposed = false;
  let lastSignature = '';
  let lastError = '';
  const monitor: Monitor = {
    window,
    playerId,
    policy: new OutputHealthPolicy(performance.now()),
    expectedIds: [],
    hidden: false,
    unavailable: false,
    requestId: 0,
    pending: new Set(),
    lastHealthAt: 0,
    listeners: new Set(),
    poll: async () => {
      if (polling || disposed || quitting || window.isDestroyed()) return;
      polling = true;
      try {
        const [player, mappings] = await bounded(
          Promise.all([getPlayer(playerId), getPlayerMappingsForPlayer(playerId)]),
        );
        if (disposed || quitting || window.isDestroyed()) return;
        const native = reconcilePlayerOutputWindows(playerId);
        const unavailable = getUnavailablePlayerOutputIds(mappings);
        monitor.expectedIds = mappings
          .map(mapping => mapping.id)
          .filter(id => !unavailable.includes(id));
        monitor.hidden = native.hidden;
        monitor.unavailable = unavailable.length > 0;
        const items = player?.playlistId ? await bounded(getPlaylistItems(player.playlistId)) : [];
        if (disposed || quitting || window.isDestroyed()) return;
        const active = Boolean(player?.autoPlay && items.length && !native.hidden);
        const reason = monitor.policy.check(monitor.expectedIds, active, performance.now());
        if (reason) {
          debug(`player ${playerId}: reload player: ${reason}`);
          monitor.pending.clear();
          monitor.lastHealth = undefined;
          // A killed renderer does not run unload handlers; close its orphaned child outputs.
          // loadURL also recovers an initial page-load failure with no committed URL.
          closePlayerOutputWindows(playerId);
          void recoverPlayerRenderer(window, url, reason.includes('did not answer')).catch(error =>
            debug(`player ${playerId}: reload failed: ${String(error)}`),
          );
        }
        const signature = JSON.stringify({
          active,
          hidden: native.hidden,
          unavailable,
          outputs: monitor.lastHealth?.outputs.map(({ id, state }) => ({ id, state })),
        });
        if (signature !== lastSignature || native.repaired) {
          lastSignature = signature;
          debug(
            `player ${playerId}: check ${signature}${native.repaired ? ' (native placement repaired)' : ''}`,
          );
        }
        const probe: OutputHealthProbe = {
          requestId: ++monitor.requestId,
          hidden: native.hidden,
          unavailableOutputIds: unavailable,
        };
        monitor.pending.add(probe.requestId);
        // A stuck renderer must not accumulate an unbounded set of outstanding probes.
        while (monitor.pending.size > 12)
          monitor.pending.delete(monitor.pending.values().next().value!);
        webContents.send('player-output:check', probe);
        lastError = '';
      } catch (error) {
        const message = String(error);
        if (message !== lastError) debug(`player ${playerId}: check failed: ${message}`);
        lastError = message;
      } finally {
        polling = false;
      }
    },
  };
  monitors.set(webContents.id, monitor);
  const timer = setInterval(() => {
    void monitor.poll();
  }, OUTPUT_HEALTH_CHECK_INTERVAL);
  timer.unref();
  const dispose = () => {
    disposed = true;
    clearInterval(timer);
    monitors.delete(webContents.id);
    monitor.listeners.clear();
  };
  webContents.once('destroyed', dispose);
  webContents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => {
    if (!mainFrame) return;
    monitor.pending.clear();
    monitor.lastHealth = undefined;
    monitor.policy.reset(performance.now());
  });
  webContents.on('did-finish-load', () => {
    void monitor.poll();
  });
};

/** Wait briefly for fresh evidence, without holding the shared scheduler queue indefinitely. */
export const checkPlayerOutput = async (playerId: number): Promise<string> => {
  const monitor = [...monitors.values()].find(item => item.playerId === playerId);
  if (!monitor) return 'Команда play принята; проверка вывода ещё не готова';
  return new Promise(resolve => {
    const startedAt = performance.now();
    const previousRequest = monitor.requestId;
    const finish = (message: string) => {
      clearTimeout(timer);
      monitor.listeners.delete(onReport);
      resolve(message);
    };
    const onReport = (report: PlayerOutputHealth) => {
      if (monitor.lastHealthAt < startedAt || report.requestId <= previousRequest) return;
      if (monitor.hidden) finish('Команда play принята; вывод намеренно скрыт');
      else if (monitor.unavailable) finish('Команда play принята; настроенный монитор недоступен');
      else if (!monitor.expectedIds.length)
        finish('Команда play принята; окна вывода не настроены');
      else if (
        hasConfirmedOutput(report, monitor.expectedIds) &&
        report.outputs
          .filter(output => monitor.expectedIds.includes(output.id))
          .every(
            output =>
              output.lastFrameAgeMs !== undefined &&
              output.lastFrameAgeMs < performance.now() - startedAt,
          )
      )
        finish('Команда play выполнена; вывод новых кадров подтверждён');
    };
    const timer = setTimeout(
      () => finish('Команда play принята; вывод кадров пока не подтверждён, проверка продолжается'),
      8_000,
    );
    monitor.listeners.add(onReport);
    void monitor.poll();
  });
};
