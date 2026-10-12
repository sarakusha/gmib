import { EventEmitter } from 'node:events';

import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showMessageBox: vi.fn(() => new Promise(() => {})),
  showErrorBox: vi.fn(),
  error: vi.fn(),
  quitAndInstall: vi.fn(),
  downloadUpdate: vi.fn(),
  isRelaunchManagedBySupervisor: vi.fn(() => false),
  needRestart: vi.fn(),
}));

vi.mock('electron', () => ({ dialog: mocks }));
vi.mock('electron-updater', () => ({
  autoUpdater: Object.assign(new EventEmitter(), {
    quitAndInstall: mocks.quitAndInstall,
    downloadUpdate: mocks.downloadUpdate,
  }),
}));
vi.mock('../src/initlog', () => ({ default: { error: mocks.error } }));
vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => false), onDidChange: vi.fn() },
}));
vi.mock('../src/relaunch', () => ({
  needRestart: mocks.needRestart,
  isRelaunchManagedBySupervisor: mocks.isRelaunchManagedBySupervisor,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRelaunchManagedBySupervisor.mockReturnValue(false);
});

it('keeps the event loop available while an update error dialog remains open', async () => {
  const { autoUpdater } = await import('electron-updater');
  await import('../src/updater');

  autoUpdater.emit('error', new Error('EACCES: permission denied'));
  await new Promise<void>(resolve => setImmediate(resolve));

  expect(mocks.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', message: expect.stringContaining('EACCES') }),
  );
  expect(mocks.showErrorBox).not.toHaveBeenCalled();
});

it.each([false, true])('installs a remote update with supervisor=%s', async supervised => {
  const { autoUpdater } = await import('electron-updater');
  const { updateAndRestart } = await import('../src/updater');
  mocks.isRelaunchManagedBySupervisor.mockReturnValue(supervised);

  const finished = updateAndRestart();
  autoUpdater.emit('update-downloaded');
  await finished;
  // Let the remote caller receive its response before shutting down the host.
  expect(mocks.quitAndInstall).not.toHaveBeenCalled();
  await new Promise<void>(resolve => setImmediate(resolve));

  expect(mocks.needRestart).toHaveBeenCalledWith(true);
  expect(mocks.quitAndInstall).toHaveBeenCalledExactlyOnceWith(
    ...(supervised ? [true, false] : []),
  );
});
