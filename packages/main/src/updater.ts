import type { MenuItem } from 'electron';
import { dialog } from 'electron';

import type { UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

import log from './initlog';

// let updater: MenuItem | null = null;
autoUpdater.autoDownload = false;
autoUpdater.logger = log;

let restart = false;

let interactive = true;

export const needRestart = () => restart;

autoUpdater.on('error', error => {
  interactive &&
    dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
});

autoUpdater.on('update-available', () => {
  interactive &&
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Найдено обновление',
        message: 'Найдено обновление, хотите установить его сейчас?',
        buttons: ['Да', 'Нет'],
      })
      .then(buttonIndex => (buttonIndex.response === 0 ? autoUpdater.downloadUpdate() : []));
});

autoUpdater.on('update-not-available', () => {
  interactive &&
    dialog.showMessageBox({
      title: 'Обновления нет',
      message: 'У Вас последняя версия.',
    });
});

autoUpdater.on('update-downloaded', () => {
  interactive &&
    dialog
      .showMessageBox({
        title: 'Установка обновления',
        message: 'Обновления загружаются, приложение закроется для обновления...',
      })
      .then(() => {
        restart = true;
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

export const checkForUpdatesNoInteractive = () =>
  new Promise<UpdateInfo | undefined>((resolve, reject) => {
    if (!interactive) return;
    interactive = false;
    let release: () => void;
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
    release = () => {
      interactive = true;
      autoUpdater.off('error', onError);
      autoUpdater.off('update-available', available);
      autoUpdater.off('update-not-available', notAvailable);
    };
    autoUpdater.once('error', onError);
    autoUpdater.once('update-available', available);
    autoUpdater.once('update-not-available', notAvailable);
    autoUpdater.checkForUpdates();
  });

export const updateAndRestart = () =>
  new Promise<void>((resolve, reject) => {
    let release: () => void;
    const onError = (err: Error) => {
      reject(err);
      release();
    };
    const downloaded = () => {
      resolve();
      restart = true;
      setImmediate(() => autoUpdater.quitAndInstall());
      release();
    };
    release = () => {
      autoUpdater.off('error', onError);
      autoUpdater.off('update-downloaded', downloaded);
    };
    autoUpdater.once('error', onError);
    autoUpdater.once('update-downloaded', downloaded);
    autoUpdater.downloadUpdate();
  });

export default checkForUpdates;
