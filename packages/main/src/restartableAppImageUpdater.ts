import { AppImageUpdater } from 'electron-updater';

/** Keep the failure/retry semantics of quitAndInstall while deferring the quit. */
export default class RestartableAppImageUpdater extends AppImageUpdater {
  override install(isSilent = false, isForceRunAfter = false): boolean {
    const installed = super.install(isSilent, isForceRunAfter);
    // BaseUpdater.quitAndInstall normally performs this reset. We call install
    // directly so that the external restart waiter can be ready before quitting.
    if (!installed) this.quitAndInstallCalled = false;
    return installed;
  }
}
