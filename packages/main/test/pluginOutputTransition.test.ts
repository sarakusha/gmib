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
import { waitForPluginOutputFrame, waitForPluginPlayerReady } from '../src/pluginOutputTransition';
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

describe('plugin screen transition readiness', () => {
  const output = () => ({
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    webContents: { capturePage: vi.fn().mockResolvedValue({ isEmpty: () => false }) },
  });

  it('waits for a captured surface and an additional compositor settling period', async () => {
    const window = output();
    const done = vi.fn();
    const wait = waitForPluginOutputFrame(window as unknown as BrowserWindow).then(done);
    await vi.advanceTimersByTimeAsync(249);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(window.webContents.capturePage).toHaveBeenCalledWith(undefined, { stayHidden: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not retire the cover if the target is hidden while settling', async () => {
    const window = output();
    const result = expect(
      waitForPluginOutputFrame(window as unknown as BrowserWindow),
    ).rejects.toThrow('скрыт');
    await vi.advanceTimersByTimeAsync(100);
    window.isVisible.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(150);
    await result;
  });

  it('rejects empty frames and bounds an unresponsive compositor', async () => {
    const window = output();
    window.webContents.capturePage.mockResolvedValueOnce({ isEmpty: () => true });
    await expect(waitForPluginOutputFrame(window as unknown as BrowserWindow)).rejects.toThrow(
      'не подготовил',
    );
    window.webContents.capturePage.mockReturnValueOnce(new Promise(() => {}));
    const result = expect(
      waitForPluginOutputFrame(window as unknown as BrowserWindow),
    ).rejects.toThrow('не подготовил');
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
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
