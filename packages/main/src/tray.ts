import { app, BrowserWindow, Menu, type MenuItem, Tray } from 'electron';
import os from 'os';
import path from 'path';

import sortBy from 'lodash/sortBy';
import maxBy from 'lodash/maxBy';

import localConfig from './localConfig';
import store, { getZIndex } from './windowStore';
import type { WindowParams } from '/@common/WindowParams';

let disableZIndex = false;

app.on('browser-window-focus', (_, window) => {
  if (!disableZIndex) {
    const params = store.get(window.id);
    if (params) params.zIndex = getZIndex();
  }
});

const serial = (items: WindowParams[], show = false) => {
  const [first, ...tail] = items;
  if (!first) {
    disableZIndex = false;
    return;
  }
  const win = BrowserWindow.fromId(first.id);
  if (!win) return;
  if (show) win.show();
  else win.moveTop();
  if (tail.length === 0) {
    win.focus();
  }
  setTimeout(() => serial(tail), 100);
};

const showAll = (show = false) => {
  const params = sortBy([...store.values()], 'zIndex');
  disableZIndex = true;
  serial(params, show);
};

const showLast = () => {
  const last = maxBy([...store.values()], 'zIndex');
  last && BrowserWindow.fromId(last.id)?.show();
};

const hideAll = () => BrowserWindow.getAllWindows().forEach(win => win.hide());

const tray: { appIcon: Tray | null } = { appIcon: null };

export const updateTray = (): void => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать все',
      click: () => {
        // log.info(`Windows: ${[...windows].map(w => w.title).join(', ')}`);
        showAll(true);
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
          role: 'quit',
          label: 'Выход',
        } as MenuItem,
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
  tray.appIcon.on('double-click', () => showAll(true));
  tray.appIcon.setToolTip(import.meta.env.VITE_APP_NAME);
  updateTray();
});

app.on('activate', () => {
  showAll();
});

export default tray;
