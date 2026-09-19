/* Browser and IPC doubles exercise output failures without an activated Electron instance. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  listeners: new Map<string, (...args: any[]) => void>(),
  invoke: vi.fn(),
  send: vi.fn(),
  attach: vi.fn(),
  detach: vi.fn(),
  state: { playbackState: 'playing', playable: true },
}));
vi.mock('electron', () => ({
  ipcRenderer: {
    on: (name: string, callback: (...args: any[]) => void) => mock.listeners.set(name, callback),
    invoke: mock.invoke,
    send: mock.send,
  },
}));
vi.mock('./mediaStream', () => ({
  attachStreamToVideo: mock.attach,
  detachStreamFromVideo: mock.detach,
  getOutputPlaybackState: () => mock.state,
}));
class FakeWindow extends EventTarget {
  closed = false;
  callbacks = new Map<number, VideoFrameRequestCallback>();
  sequence = 0;
  video = {
    muted: false,
    srcObject: { getVideoTracks: () => [{ readyState: 'live', enabled: true }] } as any,
    requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => {
      this.sequence += 1;
      this.callbacks.set(this.sequence, callback);
      return this.sequence;
    },
    cancelVideoFrameCallback: (id: number) => this.callbacks.delete(id),
  };
  canvas = { dataset: { outputFrameAt: '0' } };
  shader = false;
  document = {
    querySelectorAll: () => [this.video],
    querySelector: () => this.canvas,
    documentElement: { classList: { contains: () => this.shader } },
  };
  postMessage = vi.fn();
  close() {
    this.closed = true;
    this.dispatchEvent(new Event('beforeunload'));
  }
  frame(presentedFrames: number) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach(callback => callback(0, { presentedFrames } as VideoFrameCallbackMetadata));
  }
}
const windows: FakeWindow[] = [];
let open: ReturnType<typeof vi.fn>;
let parent: EventTarget;
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};
const check = async (now: number, options = {}) => {
  vi.setSystemTime(now);
  mock.listeners.get('player-output:check')?.(
    {},
    { requestId: now, hidden: false, unavailableOutputIds: [], ...options },
  );
  await settle();
  return mock.send.mock.lastCall?.[1];
};
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.clearAllMocks();
  mock.listeners.clear();
  windows.length = 0;
  mock.state = { playbackState: 'playing', playable: true };
  mock.invoke.mockResolvedValue([{ id: 7, source_id: 1 }]);
  open = vi.fn(() => {
    const output = new FakeWindow();
    windows.push(output);
    return output;
  });
  parent = new EventTarget();
  vi.stubGlobal('window', Object.assign(parent, { location: { search: '' }, open }));
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = { close: vi.fn() };
      port2 = { close: vi.fn() };
    },
  );
  await import('./videoOuts');
  await settle();
});
afterEach(() => {
  parent.dispatchEvent(new Event('beforeunload'));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('output presentation recovery', () => {
  it('requires real presentation and leaves healthy repeated checks untouched', async () => {
    windows[0].dispatchEvent(new Event('load'));
    expect((await check(0)).outputs[0].state).toBe('starting');
    for (let n = 1; n <= 10; n += 1) {
      vi.setSystemTime(n * 5_000);
      windows[0].frame(n);
      expect((await check(n * 5_000)).outputs[0].state).toBe('showing');
    }
    expect(open).toHaveBeenCalledTimes(1);
    expect(mock.attach).toHaveBeenCalledTimes(1);
  });
  it('detects a frozen picture in a loaded window, even with repeated identical callback metadata', async () => {
    windows[0].dispatchEvent(new Event('load'));
    windows[0].frame(1);
    await check(0);
    vi.setSystemTime(30_000);
    windows[0].frame(1);
    expect((await check(30_000)).recovery).toContain('reattach');
    expect((await check(60_000)).recovery).toContain('recreate');
    windows[1].dispatchEvent(new Event('load'));
    expect((await check(90_000)).outputs[0].state).toBe('stalled');
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('recreates a closed window and cleans callbacks without stale unload deleting its replacement', async () => {
    const old = windows[0];
    old.dispatchEvent(new Event('load'));
    old.close();
    await check(30_000);
    expect(open).toHaveBeenCalledTimes(2);
    expect(old.callbacks.size).toBe(0);
    old.dispatchEvent(new Event('beforeunload'));
    await check(35_000);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('does not recover hidden, paused, stopped, empty or unavailable output', async () => {
    windows[0].dispatchEvent(new Event('load'));
    await check(0, { hidden: true });
    expect((await check(90_000, { hidden: true })).outputs[0].state).toBe('hidden');
    mock.state.playbackState = 'paused';
    await check(120_000);
    await check(150_000);
    mock.state.playbackState = 'none';
    await check(180_000);
    mock.state = { playbackState: 'playing', playable: false };
    await check(210_000);
    mock.state.playable = true;
    expect((await check(240_000, { unavailableOutputIds: [7] })).outputs[0].state).toBe(
      'unavailable',
    );
    expect(mock.attach).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('repairs a missing stream and does not mistake stale frames for showing', async () => {
    windows[0].dispatchEvent(new Event('load'));
    windows[0].frame(1);
    windows[0].video.srcObject = null;
    expect((await check(0)).outputs[0].state).toBe('starting');
    expect((await check(30_000)).recovery).toContain('reattach');
  });
  it('escalates startup load failure through a bounded ladder', async () => {
    await check(0);
    await check(30_000);
    await check(60_000);
    expect((await check(90_000)).outputs[0].state).toBe('stalled');
    await check(120_000);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('requires canvas draws as well as video progress for shader output', async () => {
    mock.invoke.mockResolvedValue([{ id: 7, source_id: 1, shader: 'return color;' }]);
    await check(0);
    const output = windows[1];
    output.shader = true;
    output.dispatchEvent(new Event('load'));
    vi.setSystemTime(5_000);
    output.frame(1);
    expect((await check(5_000)).outputs[0].state).toBe('starting');
    output.canvas.dataset.outputFrameAt = '5000';
    expect((await check(5_000)).outputs[0].state).toBe('showing');
    vi.setSystemTime(35_000);
    output.frame(2);
    expect((await check(35_000)).recovery).toContain('reattach');
  });
  it('bounds a hanging mapping lookup and still answers a health request', async () => {
    mock.invoke.mockImplementation(() => new Promise(() => {}));
    mock.listeners.get('player-output:check')?.(
      {},
      { requestId: 1, hidden: false, unavailableOutputIds: [] },
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await settle();
    expect(mock.send.mock.lastCall?.[1].requestId).toBe(1);
  });
});
