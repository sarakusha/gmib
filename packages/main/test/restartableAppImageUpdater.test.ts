import { expect, it, vi } from 'vitest';
const install = vi.hoisted(() => vi.fn());
vi.mock('electron-updater', () => ({
  AppImageUpdater: class {
    protected quitAndInstallCalled = false;
    install() {
      if (this.quitAndInstallCalled) return false;
      this.quitAndInstallCalled = true;
      // Mirrors BaseUpdater.install: a failed doInstall retains its latch.
      return install();
    }
  },
}));
import RestartableAppImageUpdater from '../src/restartableAppImageUpdater';
it('allows a failed installation to be retried without changing successful install semantics', () => {
  install.mockReturnValueOnce(false).mockReturnValueOnce(true);
  const updater = new RestartableAppImageUpdater();
  expect(updater.install(true, false)).toBe(false);
  expect(updater.install(true, false)).toBe(true);
  expect(install).toHaveBeenCalledTimes(2);
});
