import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
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
      return [];
    }
  },
}));
vi.mock('../src/getAllDisplays', () => ({ default: () => state.displays }));
vi.mock('../src/server', () => ({ wss: { clients: [] } }));
vi.mock('../src/tabbedWindow', () => ({ broadcastToTabbedWindows: vi.fn() }));
vi.mock('../src/windowStore', () => ({
  findManagedWindow: () => undefined,
  getAllScreenParams: () => [],
  getPlayerParams: () => state.players,
  findParamsByWebContentsId: (id: number) =>
    state.players.find(player => player.webContentsId === id),
}));

import {
  getUnavailablePlayerOutputIds,
  reconcilePlayerOutputWindows,
  setPlayerOutputWindowsVisibility,
} from '../src/openHandler';
import { setOutputHidden, setPlayerOutputHidden } from '../src/outputVisibility';

const mapping = { id: 15, player: 7, name: 'main', left: 0, top: 0, kiosk: true, display: -1 };

describe('output reconciliation integration', () => {
  beforeEach(() => {
    state.displays = [{ id: 1, primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
    state.players = [{ id: 9, playerId: 7, type: 'player', webContentsId: 20 }];
    setOutputHidden(false);
    setPlayerOutputHidden(false);
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
});
