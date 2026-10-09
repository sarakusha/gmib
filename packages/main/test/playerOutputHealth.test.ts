import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedWindow } from '../src/managedWindow';
import type { PlayerOutputHealth } from '../../common/outputHealth';

const mocks = vi.hoisted(() => ({
  displays: vi.fn(),
  handlers: new Map(),
  appHandlers: new Map(),
  player: vi.fn(),
  mappings: vi.fn(),
  items: vi.fn(),
  native: vi.fn(),
  unavailable: vi.fn(),
  recover: vi.fn(),
  close: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { on: (name: string, handler: unknown) => mocks.appHandlers.set(name, handler) },
  ipcMain: { on: (name: string, handler: unknown) => mocks.handlers.set(name, handler) },
}));
vi.mock('../src/getAllDisplays', () => ({ default: mocks.displays }));
vi.mock('../src/screen', () => ({ getPlayer: mocks.player }));
vi.mock('../src/playerMapping', () => ({ getPlayerMappingsForPlayer: mocks.mappings }));
vi.mock('../src/playlist', () => ({ getPlaylistItems: mocks.items }));
vi.mock('../src/openHandler', () => ({
  reconcilePlayerOutputWindows: mocks.native,
  getUnavailablePlayerOutputIds: mocks.unavailable,
  closePlayerOutputWindows: mocks.close,
}));
vi.mock('../src/recoverPlayerRenderer', () => ({ recoverPlayerRenderer: mocks.recover }));
let api: typeof import('../src/playerOutputHealth');
let contents: EventEmitter & { id: number; mainFrame: object; send: ReturnType<typeof vi.fn> };
let win: ManagedWindow;
const settle = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
};
const reply = (
  requestId: number,
  state: 'showing' | 'starting' = 'showing',
  senderFrame = contents.mainFrame,
) => {
  const value: PlayerOutputHealth = {
    requestId,
    playbackState: 'playing',
    playable: true,
    outputs: [{ id: 7, state, lastFrameAgeMs: state === 'showing' ? 1 : undefined }],
  };
  mocks.handlers.get('player-output:health')({ sender: contents, senderFrame }, value);
};
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  });
  mocks.displays.mockReturnValue([{ id: 8, primary: true }]);
  mocks.handlers.clear();
  mocks.appHandlers.clear();
  mocks.player.mockResolvedValue({ id: 1, autoPlay: true, playlistId: 2 });
  mocks.mappings.mockResolvedValue([{ id: 7, name: 'Main', display: -1 }]);
  mocks.items.mockResolvedValue([{}]);
  mocks.native.mockReturnValue({ hidden: false, repaired: false });
  mocks.unavailable.mockReturnValue([]);
  mocks.recover.mockResolvedValue(undefined);
  contents = Object.assign(new EventEmitter(), { id: 11, mainFrame: {}, send: vi.fn() });
  win = { webContents: contents, isDestroyed: () => false } as unknown as ManagedWindow;
  api = await import('../src/playerOutputHealth');
  api.watchPlayerOutput(win, 1, 'http://localhost/player.html');
});
afterEach(() => {
  contents.emit('destroyed');
  vi.useRealTimers();
});
describe('player output supervisor integration', () => {
  it('recovers a silent renderer without restarting the whole app', async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.recover).toHaveBeenCalledWith(win, 'http://localhost/player.html', true);
    expect(mocks.close).toHaveBeenCalledWith(1);
    await vi.advanceTimersByTimeAsync(110_000);
    expect(mocks.recover).toHaveBeenCalledTimes(1);
  });
  it('ignores subframe and unsolicited reports', async () => {
    await vi.advanceTimersByTimeAsync(5_000);
    reply(1, 'showing', {});
    reply(999);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(mocks.recover).toHaveBeenCalledTimes(1);
  });
  it('requires a post-command response and fresh frames before confirmation', async () => {
    await vi.advanceTimersByTimeAsync(5_000);
    const result = api.checkPlayerOutput(1);
    let resolved = false;
    void result.then(() => {
      resolved = true;
    });
    await settle();
    reply(1);
    await settle();
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    reply(2);
    expect(await result).toContain('кадров подтверждён');
  });
  it('returns bounded accepted/pending status when presentation is not confirmed', async () => {
    const result = api.checkPlayerOutput(1);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await result).toContain('пока не подтверждён');
  });
  it.each(['paused', 'hidden', 'monitor'])('does not reload a %s output', async mode => {
    if (mode === 'paused')
      mocks.player.mockResolvedValue({ id: 1, autoPlay: false, playlistId: 2 });
    if (mode === 'hidden') mocks.native.mockReturnValue({ hidden: true, repaired: false });
    if (mode === 'monitor') mocks.unavailable.mockReturnValue([7]);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(mocks.recover).not.toHaveBeenCalled();
  });
  it('recovers monitoring after hung metadata without concurrent unbounded checks', async () => {
    mocks.mappings.mockImplementationOnce(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(contents.send).toHaveBeenCalled();
    expect(mocks.mappings.mock.calls.length).toBeLessThanOrEqual(4);
  });
  it('stops polling on quit and destruction', async () => {
    mocks.appHandlers.get('before-quit')();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(contents.send).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });
});

describe('output evidence from supervision', () => {
  it('publishes reusable health only on state changes and expires a silent report', async () => {
    const state = await import('../src/playbackOutputState');
    const listener = vi.fn();
    const unsubscribe = state.onPlaybackOutputsChanged(listener);
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
    reply(1);
    expect(state.getPlaybackOutputs(1)[0]).toMatchObject({
      state: 'showing',
      display: -1,
      resolvedDisplayId: 8,
    });
    const count = listener.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    reply(2);
    expect(listener).toHaveBeenCalledTimes(count);
    await vi.advanceTimersByTimeAsync(10000);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
    unsubscribe();
  });
  it('immediately invalidates hiding and rejects the outstanding reply until a fresh probe', async () => {
    const state = await import('../src/playbackOutputState');
    await vi.advanceTimersByTimeAsync(5000);
    reply(1);
    await vi.advanceTimersByTimeAsync(5000);
    state.invalidatePlaybackOutputs(1, 'hidden');
    reply(2);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('hidden');
    state.invalidatePlaybackOutputs(1);
    await vi.advanceTimersByTimeAsync(5000);
    reply(3);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('showing');
  });
  it('reports disconnected and returned displays without reusing pre-disconnect replies', async () => {
    const state = await import('../src/playbackOutputState');
    await vi.advanceTimersByTimeAsync(5000);
    reply(1);
    mocks.displays.mockReturnValue([]);
    mocks.unavailable.mockReturnValue([7]);
    state.invalidatePlaybackOutputs();
    await vi.advanceTimersByTimeAsync(5000);
    reply(2);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unavailable');
    mocks.displays.mockReturnValue([{ id: 8, primary: true }]);
    mocks.unavailable.mockReturnValue([]);
    state.invalidatePlaybackOutputs();
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
    reply(3);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('showing');
  });
  it('expires good evidence even when metadata lookup is hung', async () => {
    const state = await import('../src/playbackOutputState');
    await vi.advanceTimersByTimeAsync(5000);
    reply(1);
    mocks.player.mockImplementation(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(10000);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
  });
  it('rejects replies from the previous mapping and starts unknown on navigation', async () => {
    const state = await import('../src/playbackOutputState');
    await vi.advanceTimersByTimeAsync(5000);
    mocks.displays.mockReturnValue([{ id: 8, primary: true }, { id: 9 }]);
    mocks.mappings.mockResolvedValue([{ id: 7, name: 'Other', display: 9 }]);
    await vi.advanceTimersByTimeAsync(5000);
    reply(1);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
    reply(2);
    expect(state.getPlaybackOutputs(1)[0]).toMatchObject({
      state: 'showing',
      resolvedDisplayId: 9,
    });
    contents.emit('did-start-navigation', {}, 'http://localhost', false, true);
    expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
  });
});

it('does not send a stale probe after hiding while playlist metadata is in flight', async () => {
  const state = await import('../src/playbackOutputState');
  await vi.advanceTimersByTimeAsync(5000);
  reply(1);
  let resolveItems!: (value: unknown[]) => void;
  mocks.items.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveItems = resolve;
      }),
  );
  await vi.advanceTimersByTimeAsync(5000);
  state.invalidatePlaybackOutputs(1, 'hidden');
  resolveItems([{}]);
  await settle();
  expect(contents.send).toHaveBeenCalledTimes(1);
  reply(2);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('hidden');
});

it('invalidates healthy evidence when native reconciliation repairs hidden or misplaced output', async () => {
  const state = await import('../src/playbackOutputState');
  await vi.advanceTimersByTimeAsync(5000);
  reply(1);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('showing');
  mocks.native.mockReturnValue({ hidden: false, repaired: true });
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
  reply(2);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('showing');
});
