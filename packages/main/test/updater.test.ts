import type { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appImageInstances: [] as EventEmitter[],
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  showErrorBox: vi.fn(),
  error: vi.fn(),
  quitAndInstall: vi.fn(),
  downloadUpdate: vi.fn(),
  checkForUpdates: vi.fn(() => Promise.resolve()),
  install: vi.fn(() => true),
  restartWithOptions: vi.fn(() => Promise.resolve()),
  isLinuxAppImage: vi.fn(() => false),
  isRelaunchManagedBySupervisor: vi.fn(() => false),
  needRestart: vi.fn(),
}));
vi.mock('electron', () => ({ dialog: mocks }));
vi.mock('electron-updater', async () => {
  const { EventEmitter } = await import('node:events');
  class AppImageUpdater extends EventEmitter {
    constructor() {
      super();
      Object.assign(this, {
        quitAndInstall: mocks.quitAndInstall,
        downloadUpdate: mocks.downloadUpdate,
        checkForUpdates: mocks.checkForUpdates,
      });
      mocks.appImageInstances.push(this);
    }
    install(...args: unknown[]) {
      return mocks.install(...args);
    }
  }
  return {
    AppImageUpdater,
    autoUpdater: Object.assign(new AppImageUpdater(), {
      quitAndInstall: mocks.quitAndInstall,
      downloadUpdate: mocks.downloadUpdate,
      install: mocks.install,
      checkForUpdates: mocks.checkForUpdates,
    }),
  };
});
vi.mock('../src/initlog', () => ({ default: { error: mocks.error } }));
vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => false), onDidChange: vi.fn() },
}));
vi.mock('../src/relaunch', () => ({
  needRestart: mocks.needRestart,
  restartWithOptions: mocks.restartWithOptions,
  isLinuxAppImage: mocks.isLinuxAppImage,
  isRelaunchManagedBySupervisor: mocks.isRelaunchManagedBySupervisor,
  buildRelaunchOptions: (_args: unknown, _placement: unknown, execPath: string) => ({
    execPath,
    args: ['--no-sandbox', '--kiosk-mode', '--relaunch'],
  }),
}));
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
beforeEach(async () => {
  vi.resetModules();
  const { autoUpdater } = await import('electron-updater');
  autoUpdater.removeAllListeners();
  vi.clearAllMocks();
  vi.stubEnv('APPIMAGE', '/opt/gmib/gmib.AppImage');
  mocks.isLinuxAppImage.mockReturnValue(false);
  mocks.isRelaunchManagedBySupervisor.mockReturnValue(false);
  mocks.install.mockReturnValue(true);
  mocks.restartWithOptions.mockResolvedValue();
});

it('uses an asynchronous error dialog', async () => {
  const { autoUpdater } = await import('electron-updater');
  await import('../src/updater');
  autoUpdater.emit('error', new Error('EACCES: permission denied'));
  await tick();
  expect(mocks.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', message: expect.stringContaining('EACCES') }),
  );
  expect(mocks.showErrorBox).not.toHaveBeenCalled();
});

it.each([false, true])('retains existing updater routing with supervisor=%s', async supervised => {
  const { autoUpdater } = await import('electron-updater');
  const { updateAndRestart } = await import('../src/updater');
  mocks.isRelaunchManagedBySupervisor.mockReturnValue(supervised);
  mocks.isLinuxAppImage.mockReturnValue(supervised);
  const finished = updateAndRestart();
  autoUpdater.emit('update-downloaded');
  await finished;
  expect(mocks.quitAndInstall).not.toHaveBeenCalled();
  await tick();
  expect(mocks.quitAndInstall).toHaveBeenCalledExactlyOnceWith(
    ...(supervised ? [true, false] : []),
  );
  expect(mocks.install).not.toHaveBeenCalled();
});

it('menu update installs once then restarts the renamed AppImage with original arguments', async () => {
  mocks.isLinuxAppImage.mockReturnValue(true);
  await import('../src/updater');
  const autoUpdater = mocks.appImageInstances.at(-1)!;
  mocks.install.mockImplementationOnce(() => {
    autoUpdater.emit('appimage-filename-updated', '/opt/gmib/gmib-5.8.AppImage');
    return true;
  });
  autoUpdater.emit('update-downloaded');
  autoUpdater.emit('update-downloaded');
  await tick();
  await tick();
  expect(mocks.install).toHaveBeenCalledExactlyOnceWith(true, false);
  expect(mocks.quitAndInstall).not.toHaveBeenCalled();
  expect(mocks.restartWithOptions).toHaveBeenCalledExactlyOnceWith({
    execPath: '/opt/gmib/gmib-5.8.AppImage',
    args: ['--no-sandbox', '--kiosk-mode', '--relaunch'],
  });
});

it('does not schedule restart when installation fails', async () => {
  mocks.isLinuxAppImage.mockReturnValue(true);
  await import('../src/updater');
  const autoUpdater = mocks.appImageInstances.at(-1)!;
  mocks.install.mockReturnValue(false);
  autoUpdater.emit('update-downloaded');
  await tick();
  await tick();
  expect(mocks.restartWithOptions).not.toHaveBeenCalled();
  expect(mocks.needRestart).not.toHaveBeenCalled();
});

it('can retry helper startup without destructively installing a second time', async () => {
  mocks.isLinuxAppImage.mockReturnValue(true);
  await import('../src/updater');
  const autoUpdater = mocks.appImageInstances.at(-1)!;
  mocks.restartWithOptions.mockRejectedValueOnce(new Error('helper unavailable'));
  autoUpdater.emit('update-downloaded');
  await tick();
  await tick();
  expect(mocks.error).toHaveBeenCalled();
  autoUpdater.emit('update-downloaded');
  await tick();
  await tick();
  expect(mocks.install).toHaveBeenCalledTimes(1);
  expect(mocks.restartWithOptions).toHaveBeenCalledTimes(2);
});
