import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  windows: [] as unknown[],
  clients: new Set<unknown>(),
  displays: [{ id: 1, primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  handlers: new Map<string, (...args: any[]) => unknown>(),
  players: [] as { id: number; playerId: number; type: string; webContentsId: number }[],
}));
vi.mock('electron', () => ({
  app: { whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (name: string, handler: (...args: any[]) => unknown) =>
      state.handlers.set(name, handler),
  },
  BrowserWindow: class {
    static getAllWindows() {
      return state.windows;
    }
  },
}));
vi.mock('../src/getAllDisplays', () => ({ default: () => state.displays }));
vi.mock('../src/server', () => ({ wss: { clients: state.clients } }));
vi.mock('../src/tabbedWindow', () => ({ broadcastToTabbedWindows: vi.fn() }));
vi.mock('../src/windowStore', () => ({
  findPlayerWindow: () => undefined,
  findManagedWindow: () => undefined,
  getAllScreenParams: () => [],
  getPlayerParams: () => state.players,
  findParamsByWebContentsId: (id: number) =>
    state.players.find(player => player.webContentsId === id),
}));

import {
  default as openHandler,
  getUnavailablePlayerOutputIds,
  reconcilePlayerOutputWindows,
  setPlayerOutputWindowsVisibility,
  subscribePlayerOutputState,
} from '../src/openHandler';
import { setOutputHidden, setPlayerOutputHidden } from '../src/outputVisibility';

const mapping = { id: 15, player: 7, name: 'main', left: 0, top: 0, kiosk: true, display: -1 };

describe('output reconciliation integration', () => {
  beforeEach(() => {
    state.windows = [];
    state.clients.clear();
    state.displays = [{ id: 1, primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
    state.players = [{ id: 9, playerId: 7, type: 'player', webContentsId: 20 }];
    setOutputHidden(false);
    setPlayerOutputHidden(false);
  });

  it('keeps output windows in the unsandboxed player process on Electron 45', () => {
    const result = openHandler({
      url: 'http://localhost:9002/output/index.html?width=1920&height=1080&display=-1',
    } as Parameters<typeof openHandler>[0]);
    expect(result.action).toBe('allow');
    expect(result.overrideBrowserWindowOptions?.webPreferences?.sandbox).toBe(false);
    expect(
      openHandler({ url: 'https://example.com/' } as Parameters<typeof openHandler>[0]).action,
    ).toBe('deny');
  });

  it('detects unavailable mappings even when there are no output windows', () => {
    expect(getUnavailablePlayerOutputIds([mapping, { ...mapping, id: 16, display: -2 }])).toEqual([
      16,
    ]);
    state.displays = [];
    expect(getUnavailablePlayerOutputIds([mapping])).toEqual([15]);
    expect(reconcilePlayerOutputWindows(7)).toEqual({
      hidden: false,
      unavailableOutputIds: [],
      repaired: false,
    });
  });

  it('preserves hide intent for an absent window and returns effective IPC visibility by sender', () => {
    expect(setPlayerOutputWindowsVisibility(false, 7)).toBe(false);
    expect(reconcilePlayerOutputWindows(7).hidden).toBe(true);
    const handler = state.handlers.get('getOutputVisibility')!;
    expect(handler({ sender: { id: 20 } })).toBe(true);
    expect(handler({ sender: { id: 21 } })).toBe(false);
    setOutputHidden(true);
    setPlayerOutputWindowsVisibility(true, 7);
    expect(handler({ sender: { id: 20 } })).toBe(true);
  });

  it('distinguishes a visible black output from a player with no visible windows', () => {
    const handler = state.handlers.get('getPlayerOutputState')!;
    const event = { sender: { id: 20 } };
    const window = {
      isDestroyed: () => false,
      isMinimized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      webContents: { getURL: () => 'http://localhost/output/index.html?player=7' },
    };
    state.windows = [window];
    expect(handler(event)).toEqual({ hidden: false, visible: true });
    window.isVisible.mockReturnValue(false);
    expect(handler(event)).toEqual({ hidden: false, visible: false });
    window.isVisible.mockReturnValue(true);
    window.isMinimized.mockReturnValue(true);
    expect(handler(event)).toEqual({ hidden: false, visible: false });
    state.windows = [];
    expect(handler(event)).toEqual({ hidden: false, visible: false });
  });

  it('sends current and updated visibility only for the subscribed remote player', async () => {
    const socket = { readyState: 1, OPEN: 1, send: vi.fn() };
    state.clients.add(socket);
    subscribePlayerOutputState(
      socket as unknown as Parameters<typeof subscribePlayerOutputState>[0],
      7,
    );
    setPlayerOutputWindowsVisibility(false, 8);
    setPlayerOutputWindowsVisibility(false, 7);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(socket.send.mock.calls.map(([payload]) => JSON.parse(payload))).toEqual([
      { event: 'playerOutputState', playerId: 7, hidden: false, visible: false },
      { event: 'playerOutputState', playerId: 7, hidden: true, visible: false },
    ]);
  });
});
