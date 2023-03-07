import type { MenuItem } from 'electron';
import { dialog } from 'electron';

import { autoUpdater } from 'electron-updater';

import log from './initlog';

// let updater: MenuItem | null = null;
autoUpdater.autoDownload = false;
autoUpdater.logger = log;

autoUpdater.on('error', error => {
  dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
});

autoUpdater.on('update-available', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Found Updates',
      message: 'Found updates, do you want update now?',
      buttons: ['Sure', 'No'],
    })
    .then(buttonIndex => (buttonIndex.response === 0) ? autoUpdater.downloadUpdate() : []);
});

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox({
    title: 'No Updates',
    message: 'Current version is up-to-date.',
  });
  // if (updater) updater.enabled = true;
  // updater = null;
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      title: 'Install Updates',
      message: 'Updates downloaded, application will be quit for update...',
    })
    .then(() => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });
});

// export this to MenuItem click callback
function checkForUpdates(menuItem: MenuItem): void {
  const updater = menuItem;
  updater.enabled = false;
  autoUpdater.checkForUpdates().then(() => {
    updater.enabled = true;
  });
}

export default checkForUpdates;
