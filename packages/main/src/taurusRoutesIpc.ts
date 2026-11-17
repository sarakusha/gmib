import { app, ipcMain } from 'electron';

import { isGmib } from '/@common/WindowParams';
import type { WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';
import master from './MasterBrowser';
import { findParamsByWebContentsId } from './windowStore';
import { port as localHttpPort } from './config';
import { getGmibWindowUrl } from './mainWindowUrl';
import { createWindowsTaurusRoutes } from './windowsTaurusRoutes';
import {
  buildLinuxTaurusAutomaticCommand,
  buildLinuxTaurusRouteCommand,
  configureLinuxTaurusAutomatic,
  inspectLinuxTaurusRoutes,
  repairLinuxTaurusRoutes,
} from './linuxTaurusRoutes';

const windows = createWindowsTaurusRoutes();
const supported = process.platform === 'win32' || process.platform === 'linux';

export const requireLocalTaurusRouteSender = (event: Electron.IpcMainInvokeEvent): void => {
  const params = findParamsByWebContentsId(event.sender.id);
  if (
    !isGmib(params) ||
    params.host !== 'localhost' ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('Проверка USB-сети доступна только в локальном окне GMIB');
  }
  const expected = new URL(
    getGmibWindowUrl(
      localHttpPort,
      params.nibusPort,
      params.host,
      import.meta.env.DEV && !app.isPackaged ? import.meta.env.VITE_DEV_SERVER_URL : undefined,
    ),
  );
  const actual = new URL(event.senderFrame.url);
  if (event.senderFrame.origin !== expected.origin || actual.pathname !== expected.pathname) {
    throw new Error('Запрос проверки сети из недоверенной страницы');
  }
};

const inspect = async (): Promise<WindowsTaurusRouteStatus> => {
  const state =
    process.platform === 'win32'
      ? await windows.inspect()
      : process.platform === 'linux'
        ? await inspectLinuxTaurusRoutes()
        : { supported: false, elevated: false, platform: 'unsupported' as const, adapters: [] };
  const serials = new Set(master.getDiscoveredTaurusSerials().map(serial => serial.toUpperCase()));
  return {
    ...state,
    adapters: state.adapters.map(adapter => ({
      ...adapter,
      confirmedTaurus: serials.has(adapter.serialNumber.toUpperCase()),
    })),
  };
};

// Serialize scans and writes across all local GMIB windows; never launch overlapping repairs.
let pending: Promise<unknown> = Promise.resolve();
const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
};

void app.whenReady().then(() => {
  ipcMain.handle('windowsTaurusRoutes:inspect', event => {
    requireLocalTaurusRouteSender(event);
    return serialize(inspect);
  });
  ipcMain.handle('windowsTaurusRoutes:repair', (event, deviceId: unknown) => {
    requireLocalTaurusRouteSender(event);
    return serialize(async () => {
      if (!supported || typeof deviceId !== 'string') throw new Error('Неподдерживаемая операция');
      const state = await inspect();
      if (!state.adapters.some(adapter => adapter.deviceId === deviceId))
        throw new Error('USB-устройство отключено или изменилось. Повторите проверку.');
      if (!state.elevated)
        throw new Error(
          'Нужны права администратора. Скопируйте команду и выполните её с повышенными правами.',
        );
      if (process.platform === 'win32') await windows.repair(deviceId);
      else await repairLinuxTaurusRoutes(deviceId);
    });
  });
  ipcMain.handle('windowsTaurusRoutes:commands', (event, deviceId: unknown) => {
    requireLocalTaurusRouteSender(event);
    return serialize(async () => {
      if (!supported || typeof deviceId !== 'string') throw new Error('Неподдерживаемая операция');
      const state = await inspect();
      if (!state.adapters.some(adapter => adapter.deviceId === deviceId))
        throw new Error('USB-устройство отключено или изменилось. Повторите проверку.');
      return process.platform === 'win32'
        ? windows.commands(deviceId)
        : buildLinuxTaurusRouteCommand(deviceId);
    });
  });
  const automatic = (
    event: Electron.IpcMainInvokeEvent,
    deviceId: unknown,
    enabled: unknown,
    copy: boolean,
  ) => {
    requireLocalTaurusRouteSender(event);
    return serialize(async () => {
      if (!supported || typeof deviceId !== 'string' || typeof enabled !== 'boolean')
        throw new Error('Неподдерживаемая операция');
      const state = await inspect();
      if (!state.adapters.some(adapter => adapter.deviceId === deviceId))
        throw new Error('USB-устройство отключено или изменилось. Повторите проверку.');
      if (copy)
        return process.platform === 'win32'
          ? windows.automaticCommands(deviceId, enabled)
          : buildLinuxTaurusAutomaticCommand(deviceId, enabled);
      if (!state.elevated)
        throw new Error('Нужны права администратора. Скопируйте команду настройки.');
      if (process.platform === 'win32') await windows.setAutomatic(deviceId, enabled);
      else await configureLinuxTaurusAutomatic(deviceId, enabled);
      return undefined;
    });
  };
  ipcMain.handle('windowsTaurusRoutes:setAutomatic', (event, deviceId: unknown, enabled: unknown) =>
    automatic(event, deviceId, enabled, false),
  );
  ipcMain.handle(
    'windowsTaurusRoutes:automaticCommands',
    (event, deviceId: unknown, enabled: unknown) => automatic(event, deviceId, enabled, true),
  );
});
