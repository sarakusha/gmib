import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ready: Promise.resolve() as Promise<void>,
  onClose: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  getStore: vi.fn(),
  append: vi.fn(),
  cleanup: vi.fn(),
  legacyCleanup: vi.fn(),
  onOutputs: vi.fn(),
  offOutputs: vi.fn(),
  onRetention: vi.fn(),
  offRetention: vi.fn(),
  findParams: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { whenReady: () => mocks.ready, getPath: () => '/test/logs' },
  ipcMain: { on: mocks.on, removeListener: mocks.removeListener },
}));
vi.mock('../src/db', () => ({ onBeforeDatabaseClose: mocks.onClose }));
vi.mock('../src/localConfig', () => ({
  default: { get: () => 7, onDidChange: mocks.onRetention },
}));
vi.mock('../src/playbackStatisticsDatabase', () => ({
  getPlaybackStatisticsStore: mocks.getStore,
}));
vi.mock('../src/playbackEventLog', () => ({ cleanupLegacyPlaybackLogs: mocks.legacyCleanup }));
vi.mock('../src/playbackOutputState', () => ({
  getPlaybackOutputs: () => [],
  onPlaybackOutputsChanged: mocks.onOutputs,
}));
vi.mock('../src/windowStore', () => ({
  findParamsByWebContentsId: mocks.findParams,
  findManagedWindow: vi.fn(),
  getPlayerParams: () => [],
}));
vi.mock('../src/playbackRetry', () => ({ broadcastPlaybackRetry: vi.fn() }));
vi.mock('../src/server', () => ({ broadcast: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.ready = Promise.resolve();
  mocks.getStore.mockReturnValue({ append: mocks.append, cleanup: mocks.cleanup });
  mocks.append.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.legacyCleanup.mockResolvedValue(undefined);
  mocks.onOutputs.mockReturnValue(mocks.offOutputs);
  mocks.onRetention.mockReturnValue(mocks.offRetention);
  mocks.findParams.mockReturnValue({ type: 'player', playerId: 1, host: 'localhost' });
});
afterEach(() => vi.useRealTimers());

it('does not start recording if app readiness resolves after shutdown', async () => {
  let ready!: () => void;
  mocks.ready = new Promise<void>(resolve => {
    ready = resolve;
  });
  await import('../src/playbackEvents');
  await mocks.onClose.mock.calls[0][0]();
  ready();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.getStore).not.toHaveBeenCalled();
  expect(mocks.on).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('stops recording and retention producers before database shutdown', async () => {
  await import('../src/playbackEvents');
  await vi.advanceTimersByTimeAsync(0);
  const handler = mocks.on.mock.calls[0][1];
  const frame = {};
  const sender = { id: 1, mainFrame: frame, on: vi.fn(), once: vi.fn() };
  const value = {
    version: 3,
    eventId: randomUUID(),
    playbackId: randomUUID(),
    playerId: 1,
    mediaId: 'clip',
    attempt: 1,
    event: 'started',
    timestamp: new Date().toISOString(),
  };
  handler({ sender, senderFrame: frame }, value);
  expect(mocks.append).toHaveBeenCalledTimes(1);
  await mocks.onClose.mock.calls[0][0]();
  expect(mocks.removeListener).toHaveBeenCalledWith('playback:event', handler);
  expect(mocks.offOutputs).toHaveBeenCalledOnce();
  expect(mocks.offRetention).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  handler({ sender, senderFrame: frame }, { ...value, eventId: randomUUID() });
  mocks.onRetention.mock.calls[0][1]();
  await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
  expect(mocks.append).toHaveBeenCalledTimes(1);
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
});
