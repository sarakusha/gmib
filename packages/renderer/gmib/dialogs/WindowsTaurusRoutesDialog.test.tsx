import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WindowsTaurusAdapter, WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';

import WindowsTaurusRoutesDialog from './WindowsTaurusRoutesDialog';

const { remote } = vi.hoisted(() => ({ remote: { active: false } }));
vi.mock('/@common/remote', () => ({
  get isRemoteSession() {
    return remote.active;
  },
}));

const adapter: WindowsTaurusAdapter = {
  deviceId: 'USB parent',
  serialNumber: '01234',
  interfaceAlias: 'Ethernet 2',
  interfaceIndex: 15,
  interfaceGuid: 'original interface',
  defaultRoutes: [{ nextHop: '192.168.100.1', metric: 25 }],
  dnsServers: ['192.168.100.1'],
  protection: 'missing',
};
const windowsStatus: WindowsTaurusRouteStatus = {
  supported: true,
  elevated: true,
  adapters: [adapter],
  platform: 'win32',
};

const makeApi = () => ({
  isSupportedPlatform: true,
  inspect: vi.fn().mockResolvedValue(windowsStatus),
  repair: vi.fn().mockResolvedValue(undefined),
  commands: vi.fn().mockResolvedValue('PowerShell commands'),
  setAutomatic: vi.fn().mockResolvedValue(undefined),
  automaticCommands: vi.fn().mockResolvedValue('Automatic setup commands'),
});

describe('USB network diagnostics', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let api: ReturnType<typeof makeApi>;

  const render = async (requestedOpen = false, connectionState = '') => {
    act(() => {
      root.render(
        <React.StrictMode>
          <WindowsTaurusRoutesDialog
            requestedOpen={requestedOpen}
            connectionState={connectionState}
            onClose={() => undefined}
          />
        </React.StrictMode>,
      );
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
  };

  const button = (label: string) =>
    [...document.body.querySelectorAll('button')].find(element => element.textContent === label);

  const clickAction = (label: string) =>
    act(async () => {
      button(label)?.click();
      await vi.advanceTimersByTimeAsync(0);
    });

  beforeEach(() => {
    vi.useFakeTimers();
    remote.active = false;
    api = makeApi();
    vi.stubGlobal('windowsTaurusRoutes', api);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not inspect remote, browser, or unsupported desktop sessions', async () => {
    remote.active = true;
    await render(true);
    expect(api.inspect).not.toHaveBeenCalled();
    remote.active = false;
    vi.stubGlobal('windowsTaurusRoutes', undefined);
    await render(true);
    expect(api.inspect).not.toHaveBeenCalled();
    vi.stubGlobal('windowsTaurusRoutes', { ...api, isSupportedPlatform: false });
    await render(true);
    expect(api.inspect).not.toHaveBeenCalled();
  });

  it('requires confirmation before changing a candidate and only reports a verified result', async () => {
    await render();
    expect(api.inspect).toHaveBeenCalledTimes(1);
    expect(button('Исправить')?.disabled).toBe(true);
    expect(button('Копировать команды')?.disabled).toBe(true);
    act(() => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    expect(button('Исправить')?.disabled).toBe(false);

    await clickAction('Исправить');
    expect(api.repair).toHaveBeenCalledExactlyOnceWith(adapter.deviceId);
    expect(document.body.textContent).toContain('Повторная проверка не подтвердила');

    api.inspect.mockResolvedValue({
      ...windowsStatus,
      adapters: [{ ...adapter, defaultRoutes: [], protection: 'enabled' }],
    });
    await clickAction('Исправить');
    expect(document.body.textContent).toContain('Защита включена. Активного маршрута');
  });

  it('warns again for a changed interface and lets users reopen a dismissed warning', async () => {
    await render();
    act(() => button('Позже')?.click());
    expect(button('Подробнее')).toBeDefined();
    await clickAction('Подробнее');
    expect(button('Позже')).toBeDefined();
    act(() => button('Позже')?.click());
    const checksBeforeDelay = api.inspect.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(api.inspect).toHaveBeenCalledTimes(checksBeforeDelay);
    expect(button('Подробнее')).toBeDefined();

    api.inspect.mockResolvedValue({
      ...windowsStatus,
      adapters: [{ ...adapter, interfaceGuid: 'replacement interface', confirmedTaurus: true }],
    });
    await render(false, 'new Taurus connection');
    expect(button('Подробнее')).toBeUndefined();
    expect(button('Исправить')?.disabled).toBe(false);
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('coalesces network events received during an inspection into one follow-up check', async () => {
    const firstInspection = Promise.withResolvers<WindowsTaurusRouteStatus>();
    api.inspect.mockReturnValueOnce(firstInspection.promise);
    await render();
    expect(api.inspect).toHaveBeenCalledTimes(1);

    act(() => {
      for (const event of ['offline', 'online', 'focus']) window.dispatchEvent(new Event(event));
    });
    expect(api.inspect).toHaveBeenCalledTimes(1);

    firstInspection.resolve(windowsStatus);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(api.inspect).toHaveBeenCalledTimes(2);

    await render(true);
    expect(api.inspect).toHaveBeenCalledTimes(3);
  });

  it('shows missing protection separately from a live route in read-only Linux diagnostics', async () => {
    api.inspect.mockResolvedValue({
      ...windowsStatus,
      adapters: [{ ...adapter, defaultRoutes: [] }],
      platform: 'linux',
    });
    await render();
    expect(document.body.textContent).toContain(
      'Настройка gmib-kiosk (маршруты и DNS) — не задана полностью',
    );
    expect(document.body.textContent).toContain(
      'Активного маршрута 0.0.0.0/0 через этот адаптер нет',
    );
    expect(button('Исправить')).toBeUndefined();
    expect(button('Копировать команды')).toBeUndefined();
    expect(button('Проверить снова')).toBeDefined();
  });

  it('distinguishes removal of an active Linux route from persistent protection', async () => {
    const linuxAdapter = {
      ...adapter,
      confirmedTaurus: true,
      defaultRoutes: [{ ...adapter.defaultRoutes[0], table: '100' }],
    };
    const linuxStatus = { ...windowsStatus, platform: 'linux', adapters: [linuxAdapter] };
    api.inspect.mockResolvedValue(linuxStatus);
    await render();
    expect(document.body.textContent).toContain('таблица 100');
    expect(button('Исправить')?.disabled).toBe(false);
    api.inspect.mockResolvedValue({
      ...linuxStatus,
      adapters: [{ ...linuxAdapter, defaultRoutes: [] }],
    });
    await clickAction('Исправить');
    expect(api.repair).toHaveBeenCalledExactlyOnceWith(adapter.deviceId);
    expect(document.body.textContent).toContain('DHCP может добавить его снова');
    expect(document.body.textContent).toContain(
      'Настройка gmib-kiosk (маршруты и DNS) — не задана полностью',
    );
  });

  it('does not interpret an unreadable Linux routing table as an empty one', async () => {
    const linuxAdapter = { ...adapter, confirmedTaurus: true };
    const linuxStatus = { ...windowsStatus, platform: 'linux', adapters: [linuxAdapter] };
    api.inspect.mockResolvedValue(linuxStatus);
    await render();
    api.inspect.mockResolvedValue({
      ...linuxStatus,
      routeInspectionComplete: false,
      adapters: [{ ...linuxAdapter, defaultRoutes: [] }],
      diagnostic: 'Не удалось получить текущие IPv4-маршруты.',
    });
    await clickAction('Исправить');
    expect(document.body.textContent).toContain('Повторная проверка не подтвердила исправление');
    expect(document.body.textContent).not.toContain(
      'Активного маршрута 0.0.0.0/0 через этот адаптер нет',
    );
  });

  it('shows the commands for manual use even if clipboard access is unavailable', async () => {
    api.inspect.mockResolvedValue({
      ...windowsStatus,
      elevated: false,
      adapters: [{ ...adapter, confirmedTaurus: true }],
    });
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('Нет доступа к буферу обмена'));
    try {
      await render();
      expect(button('Исправить')).toBeUndefined();
      await clickAction('Копировать команды');
      expect(api.commands).toHaveBeenCalledExactlyOnceWith(adapter.deviceId);
      expect(document.body.querySelector('pre')?.textContent).toBe('PowerShell commands');
      expect(document.body.textContent).toContain('Нет доступа к буферу обмена');
    } finally {
      writeText.mockRestore();
    }
  });

  it('enables automatic repair without an active route only after confirmation and verifies disable', async () => {
    const safeAdapter = { ...adapter, defaultRoutes: [], autoEnabled: false };
    api.inspect.mockResolvedValue({ ...windowsStatus, adapters: [safeAdapter] });
    await render(true);
    expect(button('Исправить')).toBeUndefined();
    expect(button('Включить автоисправление')?.disabled).toBe(true);
    act(() => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    await clickAction('Включить автоисправление');
    expect(api.setAutomatic).toHaveBeenCalledExactlyOnceWith(adapter.deviceId, true);
    expect(document.body.textContent).toContain('Повторная проверка не подтвердила состояние');
    expect(button('Выключить автоисправление')).toBeUndefined();

    api.inspect.mockResolvedValue({
      ...windowsStatus,
      adapters: [{ ...safeAdapter, autoEnabled: true }],
    });
    await clickAction('Включить автоисправление');
    expect(document.body.textContent).toContain('Автоисправление включено.');
    expect(button('Копировать команду выключения')?.disabled).toBe(false);

    api.inspect.mockResolvedValue({ ...windowsStatus, adapters: [safeAdapter] });
    await clickAction('Выключить автоисправление');
    expect(api.setAutomatic).toHaveBeenLastCalledWith(adapter.deviceId, false);
    expect(document.body.textContent).toContain('Автоисправление выключено.');
  });

  it('leaves auto repair off when a nonadministrator requests commands and clipboard fails', async () => {
    api.inspect.mockResolvedValue({
      ...windowsStatus,
      elevated: false,
      adapters: [{ ...adapter, confirmedTaurus: true, autoEnabled: false }],
    });
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('Нет доступа к буферу обмена'));
    try {
      await render();
      await clickAction('Копировать команду включения');
      expect(api.automaticCommands).toHaveBeenCalledExactlyOnceWith(adapter.deviceId, true);
      expect(api.setAutomatic).not.toHaveBeenCalled();
      expect(document.body.querySelector('pre')?.textContent).toBe('Automatic setup commands');
      expect(button('Копировать команду выключения')).toBeUndefined();
      expect(document.body.textContent).toContain('Выключено.');
      expect(document.body.textContent).toContain('Нет доступа к буферу обмена');
    } finally {
      writeText.mockRestore();
    }
  });

  it('requires consent for all RNDIS devices before applying the Linux Netplan rule', async () => {
    const linuxAdapter = {
      ...adapter,
      confirmedTaurus: true,
      defaultRoutes: [],
      autoEnabled: false,
    };
    const linuxStatus = { ...windowsStatus, platform: 'linux', adapters: [linuxAdapter] };
    api.inspect.mockResolvedValue(linuxStatus);
    await render();
    expect(button('Настроить защиту как в gmib-kiosk')?.disabled).toBe(true);
    expect(button('Копировать команду настройки')?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      'Правило будет действовать для всех USB RNDIS-адаптеров',
    );
    expect(document.body.textContent).not.toContain('примерно раз в минуту');

    act(() => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    api.inspect.mockResolvedValue({
      ...linuxStatus,
      adapters: [{ ...linuxAdapter, autoEnabled: true }],
    });
    await clickAction('Настроить защиту как в gmib-kiosk');
    expect(api.setAutomatic).toHaveBeenCalledExactlyOnceWith(adapter.deviceId, true);
    expect(document.body.textContent).toContain('Для применения нужна перезагрузка.');
    expect(button('Удалить правило GMIB')?.disabled).toBe(false);
  });

  it('skips the Linux install option when the kiosk policy already applies or Netplan is unsupported', async () => {
    const linuxAdapter = { ...adapter, defaultRoutes: [], autoEnabled: false };
    api.inspect.mockResolvedValue({
      ...windowsStatus,
      platform: 'linux',
      adapters: [
        { ...linuxAdapter, protection: 'enabled' },
        { ...linuxAdapter, deviceId: 'other device', automaticSupported: false },
      ],
    });
    await render(true);
    expect(document.body.textContent).toContain('Защита уже настроена.');
    expect(button('Настроить защиту как в gmib-kiosk')).toBeUndefined();
    expect(button('Копировать команду настройки')).toBeUndefined();
  });
});
