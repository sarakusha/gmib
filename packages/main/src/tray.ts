import type { MenuItem, MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, Menu, Tray } from 'electron';
import os from 'os';
import path from 'path';

import sortBy from 'lodash/sortBy';

import localConfig from './localConfig';
import { needRestart } from './relaunch';
import store, { getZIndex } from './windowStore';

import { isGmib, isPlayer } from '/@common/WindowParams';

let disableZIndex = false;

app.on('browser-window-focus', (_, window) => {
  if (!disableZIndex) {
    const params = store.get(window.id);
    if (params && (isGmib(params) || isPlayer(params))) params.zIndex = getZIndex();
  }
});

const getAllWindowParams = () =>
  sortBy(
    [...store.values()].filter(param => isPlayer(param) || isGmib(param)),
    'zIndex',
  );

const showLast = () => {
  const top = getAllWindowParams().at(-1);
  top && BrowserWindow.fromId(top.id)?.show();
};

const showAll = () => {
  disableZIndex = true;
  const params = getAllWindowParams();
  const [top] = params.splice(-1, 1);
  params.forEach(({ id }) => {
    const win = BrowserWindow.fromId(id);
    if (win) {
      if (win.isMinimized()) win.show();
      else win.showInactive();
      setTimeout(() => win.webContents.send('focus', false), 100);
    }
  });
  setTimeout(() => {
    disableZIndex = false;
    const win = top && BrowserWindow.fromId(top.id);
    if (win) {
      if (win.isMinimized()) win.restore();
      else win.show();
      win.focus();
    }
  }, 100);
};

const hideAll = () => {
  getAllWindowParams().forEach(({ id }) => BrowserWindow.fromId(id)?.hide());
};

const tray: { appIcon: Tray | null } = { appIcon: null };

export const updateTray = (): void => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать все',
      click: () => {
        // log.info(`Windows: ${[...windows].map(w => w.title).join(', ')}`);
        showAll();
      },
    },
    {
      label: 'Скрыть все',
      click: () => {
        // log.info(`Windows: ${[...windows].map(w => w.title).join(', ')}`);
        hideAll();
      },
    },
    {
      label: 'Автозапуск',
      type: 'checkbox',
      click: mi => {
        localConfig.set('autostart', mi.checked);
      },
      checked: localConfig.get('autostart'),
    },
    ...(localConfig.get('autostart')
      ? []
      : [
          { type: 'separator' } as MenuItem,
          {
            // role: 'quit',
            click: () => {
              needRestart();
              app.quit();
            },
            label: 'Выход',
          } as MenuItemConstructorOptions,
        ]),
  ]);
  tray && tray.appIcon?.setContextMenu(contextMenu);
};

const assets = path.resolve(__dirname, '../../renderer/assets');

app.whenReady().then(() => {
  let icon = path.join(assets, 'icon16x16.png');
  if (process.platform === 'win32') icon = path.join(assets, 'icon.ico');
  else if (process.platform === 'linux' && os.version().indexOf('astra') !== -1)
    icon = path.join(assets, '32x32.png');
  tray.appIcon = new Tray(icon);
  tray.appIcon.on('click', showLast);
  tray.appIcon.on('double-click', () => showAll());
  tray.appIcon.setToolTip(import.meta.env.VITE_APP_NAME);
  updateTray();
});

app.on('activate', () => {
  showAll();
});

export default tray;
