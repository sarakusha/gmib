import { EventEmitter } from 'node:events';

import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ManagedWindow } from '../src/managedWindow';
import type { Screen } from '/@common/video';

const mock = vi.hoisted(() => ({
  native: new Map<number, unknown>(),
  tabs: new Map<number, unknown>(),
  handlers: new Map<string, (...args: any[]) => unknown>(),
}));
vi.mock('electron', () => ({
  app: { whenReady: () => Promise.resolve() },
  BrowserWindow: {
    fromId: (id: number) => mock.native.get(id),
    fromWebContents: () => mock.native.get(3),
  },
  ipcMain: {
    handle: (name: string, handler: (...args: any[]) => unknown) =>
      mock.handlers.set(name, handler),
  },
}));
vi.mock('../src/tabbedWindow', () => ({ getTabbedWindowById: (id: number) => mock.tabs.get(id) }));
vi.mock('../src/getAnnounce', () => ({ default: async () => ({ info: { version: '5.7.2' } }) }));
vi.mock('../src/linux', () => ({ initializePritunlClient: vi.fn() }));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: () => undefined }));
vi.mock('../src/licenseState', () => ({
  getLicenseState: () => ({ status: 'active', plan: 'plus' }),
  getSessionLicensePresentation: () => ({}),
}));
vi.mock('../src/localConfig', () => ({ default: { get: vi.fn() } }));
vi.mock('../src/operatingSystem', () => ({ getOperatingSystem: () => 'test' }));
vi.mock('../src/machineId', () => ({ default: Promise.resolve('test-machine') }));
vi.mock('../src/legacyLicenseStorage', () => ({
  applyLegacyLicenseUpdate: vi.fn(),
  parseLegacyLicenseUpdate: vi.fn(),
}));
vi.mock('../src/updater', () => ({
  checkForUpdatesNoInteractive: vi.fn(),
  updateAndRestart: vi.fn(),
}));

function window(id: number, contentsId: number) {
  return Object.assign(new EventEmitter(), {
    id,
    isDestroyed: () => false,
    webContents: Object.assign(new EventEmitter(), {
      id: contentsId,
      send: vi.fn(),
      isLoading: () => true,
    }),
  });
}

beforeEach(() => {
  vi.resetModules();
  mock.native.clear();
  mock.tabs.clear();
  mock.handlers.clear();
});

describe('managed window identities', () => {
  it.each(['localhost', '192.168.0.152'])(
    'keeps %s connection when a native output shares the renderer id',
    async host => {
      const registry = await import('../src/windowStore');
      const tab = window(-3, 3);
      const screen = window(3, 8);
      mock.tabs.set(tab.id, tab);
      mock.native.set(screen.id, screen);
      await registry.registerGmib(tab as unknown as ManagedWindow, { host, nibusPort: 9001 });
      registry.registerScreen(
        screen as unknown as BrowserWindow,
        { id: 1, width: 704, height: 192 } as Screen,
      );
      expect(registry.findParamsByWebContentsId(3)).toMatchObject({ type: 'gmib', host, id: -3 });
      expect(registry.findParamsByWebContentsId(8)).toMatchObject({
        type: 'screen',
        screenId: 1,
        id: 3,
      });
      expect(registry.findManagedWindow(-3)).toBe(tab);
      expect(registry.findManagedWindow(3)).toBe(screen);
      expect(mock.handlers.get('getParams')!({ sender: { id: 3 } }, 'host')).toBe(host);
      expect(mock.handlers.get('getParams')!({ sender: { id: 999 } }, 'host')).toBeUndefined();
      screen.emit('closed');
      expect(registry.findParamsByWebContentsId(3)).toMatchObject({ type: 'gmib', host });
      expect(registry.default.has(3)).toBe(false);
    },
  );

  it('closing a tab leaves the native output and other player context intact', async () => {
    const registry = await import('../src/windowStore');
    const tab = window(-3, 3);
    const player = window(-4, 4);
    const screen = window(3, 8);
    mock.tabs.set(tab.id, tab);
    mock.tabs.set(player.id, player);
    mock.native.set(screen.id, screen);
    const parent = await registry.registerGmib(tab as unknown as ManagedWindow, {
      host: 'localhost',
      nibusPort: 9001,
    });
    registry.registerPlayer(
      player as unknown as ManagedWindow,
      { host: 'localhost', port: 9001, playerId: 7 },
      parent!,
    );
    registry.registerScreen(screen as unknown as BrowserWindow, { id: 1 } as Screen);
    tab.emit('closed');
    expect(registry.findParamsByWebContentsId(3)).toBeUndefined();
    expect(registry.findParamsByWebContentsId(4)).toMatchObject({ type: 'player', playerId: 7 });
    expect(registry.findParamsByWebContentsId(8)).toMatchObject({ type: 'screen', screenId: 1 });
  });
});
