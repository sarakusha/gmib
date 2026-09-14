import { Address, getNibusSession, type INibusConnection, type INibusSession } from '@nibus/core';
import type { PluginManifest } from '/@common/plugins';
import type {
  PluginInformationReport,
  PluginNibusApi,
  PluginNibusConnection,
  PluginNibusOutput,
} from '/@common/pluginNibus';
import {
  decodePluginReport,
  encodePluginPenalties,
  encodePluginScoreboard,
  encodePluginTeams,
  encodePluginTimer,
  informationReport,
} from './pluginNibusCodec';

const connections = new Map<string, INibusConnection>();
const listeners = new Set<(connections: PluginNibusConnection[]) => void>();
const reportListeners = new Set<(report: PluginInformationReport) => void>();
const writers = new Map<string, string>();
let session: INibusSession | undefined;
let starting: Promise<void> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let users = 0;
let stopped = false;
const list = () =>
  [...connections.values()]
    .filter(connection => !connection.isClosed)
    .map(connection => ({ id: connection.path, name: connection.path }));
const changed = () => {
  const current = list();
  for (const listener of listeners) {
    try {
      listener(current);
    } catch {
      /* Consumer isolation. */
    }
  }
};
const start = (): void => {
  if (stopped || starting || session) return;
  // Omitting host uses the local IPC protocol; no renderer window timers or second serial open.
  const next = getNibusSession(+(process.env.NIBUS_PORT ?? 9001));
  session = next;
  next.on('add', connection => {
    connections.set(connection.path, connection);
    changed();
  });
  next.on('remove', connection => {
    connections.delete(connection.path);
    changed();
  });
  next.on('informationReport', (connection, info) => {
    const report = decodePluginReport(connection.path, info);
    if (report)
      for (const listener of reportListeners) {
        try {
          listener(report);
        } catch {
          /* Consumer isolation. */
        }
      }
  });
  const reconnect = () => {
    if (session !== next) return;
    session = undefined;
    connections.clear();
    changed();
    if (!stopped) {
      clearTimeout(retry);
      retry = setTimeout(start, 3000);
      retry.unref();
    }
  };
  next.once('close', reconnect);
  starting = next
    .start()
    .then(() => {
      changed();
    })
    .catch(() => {
      next.close();
      reconnect();
    })
    .finally(() => {
      starting = undefined;
    });
};

export function createPluginNibus(
  manifest: PluginManifest,
  onDispose: (handler: () => void | Promise<void>) => void,
): PluginNibusApi {
  users += 1;
  stopped = false;
  const ownDisposers: Array<() => void | Promise<void>> = [];
  const check = (permission: 'nibus.read' | 'nibus.write') => {
    if (!manifest.permissions?.includes(permission))
      throw new Error(`Отсутствует разрешение ${permission}`);
    start();
  };
  onDispose(async () => {
    for (const dispose of ownDisposers.reverse()) await dispose();
    users -= 1;
    if (users === 0) {
      stopped = true;
      clearTimeout(retry);
      session?.close();
      session = undefined;
      connections.clear();
    }
  });
  return {
    listConnections: () => {
      check('nibus.read');
      return Promise.resolve(list());
    },
    onConnectionChange: handler => {
      check('nibus.read');
      listeners.add(handler);
      const unsubscribe = () => {
        listeners.delete(handler);
      };
      ownDisposers.push(unsubscribe);
      return unsubscribe;
    },
    onInformationReport: (filter, handler) => {
      check('nibus.read');
      const source = filter.source ? new Address(filter.source).toString() : undefined;
      const listener = (report: PluginInformationReport) => {
        if (filter.connectionId && report.connectionId !== filter.connectionId) return;
        if (source && report.source !== source) return;
        if (filter.kinds && !filter.kinds.includes(report.kind)) return;
        handler(structuredClone(report));
      };
      reportListeners.add(listener);
      const unsubscribe = () => {
        reportListeners.delete(listener);
      };
      ownDisposers.push(unsubscribe);
      return unsubscribe;
    },
    acquireOutput: options => {
      check('nibus.write');
      if (
        options.profile !== 'matchpad' ||
        !options.connectionId ||
        options.connectionId.length > 256
      )
        throw new Error('Некорректный профиль NiBUS');
      const target = new Address(options.target).toString();
      if (writers.has(options.connectionId))
        throw new Error('Соединение NiBUS уже управляется плагином');
      writers.set(options.connectionId, manifest.id);
      const latest = new Map<number, Buffer>();
      const pending = new Map<number, Buffer>();
      let released = false;
      let sending: Promise<void> | undefined;
      let lastRefresh = 0;
      let lastConnection: INibusConnection | undefined;
      const flush = () => {
        if (released || sending) return;
        const connection = connections.get(options.connectionId);
        if (!connection || connection.isClosed) return;
        const refresh = connection !== lastConnection || Date.now() - lastRefresh >= 3000;
        if (refresh) {
          latest.forEach((payload, id) => pending.set(id, payload));
          lastConnection = connection;
          lastRefresh = Date.now();
        }
        if (!pending.size) return;
        const batch = [...pending];
        pending.clear();
        sending = (async () => {
          for (const [id, payload] of batch) {
            if (released) break;
            await connection.sendDatagram(informationReport(target, id, payload));
          }
        })()
          .catch(() => {
            lastConnection = undefined;
          })
          .finally(() => {
            sending = undefined;
          });
      };
      const timer = setInterval(flush, 100);
      timer.unref();
      const enqueue = (reports: Array<[number, Buffer]>) => {
        if (released) throw new Error('Вывод NiBUS освобождён');
        for (const [id, payload] of reports) {
          if (payload.length > 63) throw new Error('Слишком большой отчёт NiBUS');
          if (!latest.get(id)?.equals(payload)) pending.set(id, payload);
          latest.set(id, payload);
        }
        return Promise.resolve();
      };
      const output: PluginNibusOutput = {
        sendTimer: state => {
          if (state.mode !== 'game') {
            latest.delete(50);
            pending.delete(50);
          }
          return enqueue(encodePluginTimer(state));
        },
        sendScoreboard: state => enqueue(encodePluginScoreboard(state)),
        sendPenalties: state => enqueue(encodePluginPenalties(state)),
        sendTeams: state => enqueue(encodePluginTeams(state)),
        release: async () => {
          if (released) return;
          released = true;
          clearInterval(timer);
          pending.clear();
          latest.clear();
          await sending;
          writers.delete(options.connectionId);
        },
      };
      ownDisposers.push(output.release);
      return Promise.resolve(output);
    },
  };
}
