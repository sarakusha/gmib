import type { MenuItem } from 'electron';
import { dialog } from 'electron';
import os from 'node:os';

import type { UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

import log from './initlog';
import localConfig from './localConfig';
import { needRestart } from './relaunch';

export const automaticUpdatesSupported = (
  platform = process.platform,
  systemRelease = os.release(),
): boolean => {
  if (platform !== 'win32') return true;
  const major = Number.parseInt(systemRelease.split('.')[0] ?? '', 10);
  return Number.isFinite(major) && major >= 10;
};

const updatesSupported = automaticUpdatesSupported();
const unsupportedWindowsMessage =
  'Автоматическое обновление отключено: Windows 7/8/8.1 не поддерживаются новыми версиями GMIB.';

// let updater: MenuItem | null = null;
autoUpdater.autoDownload = updatesSupported && localConfig.get('autoUpdate');
autoUpdater.logger = log;

localConfig.onDidChange('autoUpdate', value => {
  autoUpdater.autoDownload = updatesSupported && !!value;
});

let interactive = true;

autoUpdater.on('error', error => {
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
  needRestart(true);
  setImmediate(() => autoUpdater.quitAndInstall());
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
  if (!updatesSupported) {
    void dialog.showMessageBox({
      type: 'info',
      title: 'Обновление недоступно',
      message: unsupportedWindowsMessage,
    });
    return;
  }
  updater.enabled = false;
  void autoUpdater.checkForUpdates().then(() => {
    updater.enabled = true;
  });
}

export const checkForUpdatesNoInteractive = () => {
  if (!updatesSupported) return Promise.resolve(undefined);
  return new Promise<UpdateInfo | undefined>((resolve, reject) => {
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
};

export const updateAndRestart = () => {
  if (!updatesSupported) return Promise.reject(new Error(unsupportedWindowsMessage));
  return new Promise<void>((resolve, reject) => {
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
};

export default checkForUpdates;
