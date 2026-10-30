import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';
import type { BrowserWindow } from 'electron';

const mock = vi.hoisted(() => ({
  check: vi.fn(),
  get: vi.fn(),
  off: vi.fn(),
  changed: vi.fn(),
}));
vi.mock('../src/playerOutputHealth', () => ({ checkPlayerOutput: mock.check }));
vi.mock('../src/playbackOutputState', () => ({
  getPlaybackOutputs: mock.get,
  onPlaybackOutputsChanged: mock.changed,
}));
import { waitForPluginOutputSettle, waitForPluginPlayerReady } from '../src/pluginOutputTransition';
let changed: (id: number) => void;
const state = (...states: PlaybackOutputSnapshot['state'][]) =>
  states.map((value, id) => ({ id, name: String(id), state: value }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mock.get.mockReturnValue(state('starting'));
  mock.check.mockResolvedValue('Проверка');
  mock.changed.mockImplementation(listener => {
    changed = listener;
    return mock.off;
  });
});
afterEach(() => vi.useRealTimers());

describe('plugin screen transition settling', () => {
  const output = () => ({
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    webContents: {
      isDestroyed: vi.fn(() => false),
      executeJavaScript: vi.fn().mockRejectedValue(new Error('Renderer execution must not run')),
      capturePage: vi.fn().mockRejectedValue(new Error('Unknown Viz Error')),
    },
  });
  const expectNoRendererRequests = (window: ReturnType<typeof output>) => {
    expect(window.webContents.capturePage).not.toHaveBeenCalled();
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
  };
  const invalidate = (window: ReturnType<typeof output>, state: string) => {
    if (state === 'hidden') window.isVisible.mockReturnValue(false);
    else if (state === 'window destroyed') window.isDestroyed.mockReturnValue(true);
    else window.webContents.isDestroyed.mockReturnValue(true);
  };

  it('keeps the cover for a full 500 ms without capture or renderer execution', async () => {
    const window = output();
    const done = vi.fn();
    const wait = waitForPluginOutputSettle(window as unknown as BrowserWindow).then(done);
    await vi.advanceTimersByTimeAsync(499);
    expect(done).not.toHaveBeenCalled();
    expectNoRendererRequests(window);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(done).toHaveBeenCalledOnce();
    expectNoRendererRequests(window);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['hidden', 'window destroyed', 'webContents destroyed'])(
    'rejects an initially unavailable output (%s) without starting the wait',
    async state => {
      const window = output();
      invalidate(window, state);
      await expect(waitForPluginOutputSettle(window as unknown as BrowserWindow)).rejects.toThrow();
      expectNoRendererRequests(window);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(['hidden', 'window destroyed', 'webContents destroyed'])(
    'does not retire the cover when availability changes during settling (%s)',
    async state => {
      const window = output();
      const result = expect(
        waitForPluginOutputSettle(window as unknown as BrowserWindow),
      ).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(100);
      invalidate(window, state);
      await vi.advanceTimersByTimeAsync(400);
      await result;
      expectNoRendererRequests(window);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});

describe('plugin player transition readiness', () => {
  it('keeps the cover until every output of the selected player shows a frame', async () => {
    const done = vi.fn();
    const wait = waitForPluginPlayerReady(7).then(done);
    expect(mock.check).toHaveBeenCalledWith(7);
    mock.get.mockReturnValue(state('showing', 'starting'));
    changed(7);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    mock.get.mockReturnValue(state('showing', 'showing'));
    changed(8);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    changed(7);
    await wait;
    expect(mock.off).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects missing or unready outputs after a bounded wait and removes its listener', async () => {
    mock.get.mockReturnValue([]);
    const wait = waitForPluginPlayerReady(7);
    const result = expect(wait).rejects.toThrow('не подготовил изображение');
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    expect(mock.off).toHaveBeenCalledOnce();
  });

  it('does not wait when current frame evidence is already available', async () => {
    mock.get.mockReturnValue(state('showing'));
    await waitForPluginPlayerReady(7);
    expect(mock.check).not.toHaveBeenCalled();
    expect(mock.off).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the listener and timeout after probe failure', async () => {
    mock.check.mockRejectedValue(new Error('Probe failed'));
    await expect(waitForPluginPlayerReady(7)).rejects.toThrow('Probe failed');
    expect(mock.off).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
