import { app, BrowserWindow, Menu, type MenuItem, Tray } from 'electron';
import os from 'os';
import path from 'path';

import sortBy from 'lodash/sortBy';

import localConfig from './localConfig';
import store, { getZIndex } from './windowStore';
import { isGmib, isPlayer, type WindowParams } from '/@common/WindowParams';
import { getMainWindow } from './mainWindow';

let disableZIndex = false;

app.on('browser-window-focus', (_, window) => {
  if (!disableZIndex) {
    const params = store.get(window.id);
    if (params && (isGmib(params) || isPlayer(params))) params.zIndex = getZIndex();
  }
});

// const serial = (items: WindowParams[], show = false) => {
//   const [first, ...tail] = items;
//   if (!first) {
//     disableZIndex = false;
//     return;
//   }
//   const win = BrowserWindow.fromId(first.id);
//   if (!win) return;
//   if (show) win.show();
//   else win.moveTop();
//   if (tail.length === 0) {
//     win.focus();
//   }
//   setTimeout(() => serial(tail), 100);
// };
//

// let topWindow = 1;

// app.on('browser-window-focus', (_, win) => {
//   topWindow = win.id;
//   console.log('TOP', topWindow);
// });

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
    console.log({ id, win: !!win, min: win?.isMinimized() });
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
  // const top = BrowserWindow.getFocusedWindow();
  // console.log({ topWindow, top: top?.id });
  getAllWindowParams().forEach(({ id }) => BrowserWindow.fromId(id)?.hide());
  // BrowserWindow.fromId(topWindow)?.hide();
  // setTimeout(() => { topWindow = top?.id ?? 1;}, 100);
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
  tray.appIcon.on('double-click', () => showAll());
  tray.appIcon.setToolTip(import.meta.env.VITE_APP_NAME);
  updateTray();
});

app.on('activate', () => {
  showAll();
});

export default tray;
