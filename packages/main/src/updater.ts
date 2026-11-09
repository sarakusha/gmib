import type { MenuItem } from 'electron';
import { dialog } from 'electron';

import type { UpdateInfo } from 'electron-updater';
import { AppImageUpdater, autoUpdater as defaultUpdater } from 'electron-updater';
import RestartableAppImageUpdater from './restartableAppImageUpdater';

import log from './initlog';
import localConfig from './localConfig';
import {
  buildRelaunchOptions,
  isLinuxAppImage,
  isRelaunchManagedBySupervisor,
  needRestart,
  restartWithOptions,
} from './relaunch';

const autoUpdater =
  isLinuxAppImage() && !isRelaunchManagedBySupervisor()
    ? new RestartableAppImageUpdater()
    : defaultUpdater;
autoUpdater.autoDownload = localConfig.get('autoUpdate');
autoUpdater.logger = log;

localConfig.onDidChange('autoUpdate', value => {
  autoUpdater.autoDownload = !!value;
});

let interactive = true;
let updateRestartPending = false;
let installedAppImagePath: string | undefined;

autoUpdater.on('error', error => {
  if (updateRestartPending) {
    updateRestartPending = false;
    needRestart(false);
  }
  if (!interactive) return;
  // A synchronous error dialog blocks the HTTP API and discovery on a headless kiosk.
  void dialog
    .showMessageBox({
      type: 'error',
      title: 'Ошибка обновления',
      message: error == null ? 'unknown' : (error.stack || error).toString(),
    })
    .catch(dialogError => log.error('Failed to show update error', dialogError));
});

autoUpdater.on('update-available', () => {
  if (interactive) {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Найдено обновление',
        message: 'Найдено обновление, хотите установить его сейчас?',
        buttons: ['Да', 'Нет'],
      })
      .then(buttonIndex => (buttonIndex.response === 0 ? autoUpdater.downloadUpdate() : []));
  }
});

autoUpdater.on('update-not-available', () => {
  if (interactive) {
    void dialog.showMessageBox({
      title: 'Обновления нет',
      message: 'У Вас последняя версия.',
    });
  }
});

const quitAndRestart = () => {
  if (updateRestartPending) return;
  updateRestartPending = true;
  setImmediate(() => {
    void (async () => {
      if (isRelaunchManagedBySupervisor()) {
        needRestart(true);
        autoUpdater.quitAndInstall(true, false);
      } else if (isLinuxAppImage() && autoUpdater instanceof AppImageUpdater) {
        // Use the updater's public install operation, but start the replacement
        // only after this process exits, preserving the original kiosk arguments.
        if (!installedAppImagePath) {
          let destination = process.env.APPIMAGE;
          const filenameUpdated = (filename: string) => {
            destination = filename;
            process.env.APPIMAGE = filename;
          };
          autoUpdater.on('appimage-filename-updated', filenameUpdated);
          try {
            if (!autoUpdater.install(true, false)) {
              updateRestartPending = false;
              return;
            }
          } finally {
            autoUpdater.off('appimage-filename-updated', filenameUpdated);
          }
          installedAppImagePath = destination;
        }
        await restartWithOptions(buildRelaunchOptions(undefined, undefined, installedAppImagePath));
      } else {
        needRestart(true);
        autoUpdater.quitAndInstall();
      }
    })().catch(error => {
      updateRestartPending = false;
      needRestart(false);
      log.error('Update restart failed; the installed AppImage can be started manually', error);
      autoUpdater.emit('error', error);
    });
  });
};

autoUpdater.on('update-downloaded', () => {
  if (interactive) {
    if (localConfig.get('autoUpdate')) quitAndRestart();
    else
      void dialog
        .showMessageBox({
          title: 'Установка обновления',
          message: 'Обновления загружаются, приложение закроется для обновления...',
        })
        .then(quitAndRestart);
  }
});

// export this to MenuItem click callback
function checkForUpdates(menuItem: MenuItem): void {
  const updater = menuItem;
  updater.enabled = false;
  void autoUpdater
    .checkForUpdates()
    .catch(error => log.error('Update check failed', error))
    .finally(() => {
      updater.enabled = true;
    });
}

export const checkForUpdatesNoInteractive = () =>
  new Promise<UpdateInfo | undefined>((resolve, reject) => {
    if (!interactive) return;
    interactive = false;
    const available = (info: UpdateInfo) => {
      resolve(info);
      release();
    };
    const notAvailable = () => {
      resolve(undefined);
      release();
    };
    const onError = (err: Error) => {
      reject(err);
      release();
    };
    const release = (): void => {
      autoUpdater.off('error', onError);
      autoUpdater.off('update-available', available);
      autoUpdater.off('update-not-available', notAvailable);
    };
    autoUpdater.once('error', onError);
    autoUpdater.once('update-available', available);
    autoUpdater.once('update-not-available', notAvailable);
    void autoUpdater.checkForUpdates();
  }).finally(() => {
    interactive = true;
  });

export const updateAndRestart = () =>
  new Promise<void>((resolve, reject) => {
    if (!interactive) return;
    interactive = false;
    const onError = (err: Error) => {
      reject(err);
      release();
    };
    const downloaded = () => {
      resolve();
      quitAndRestart();
      release();
    };
    const release = (): void => {
      autoUpdater.off('error', onError);
      autoUpdater.off('update-downloaded', downloaded);
    };
    autoUpdater.once('error', onError);
    autoUpdater.once('update-downloaded', downloaded);
    void autoUpdater.downloadUpdate();
  }).finally(() => {
    interactive = true;
  });

export default checkForUpdates;
