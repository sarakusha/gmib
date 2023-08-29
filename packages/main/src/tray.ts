import { app, BrowserWindow, Menu, type MenuItem, Tray } from 'electron';
import os from 'os';
import path from 'path';

// import { hideAll, showAll } from '../bak/windows';

import localConfig from './localConfig';

const showAll = () => BrowserWindow.getAllWindows().forEach(win => win.show());
const hideAll = () => BrowserWindow.getAllWindows().forEach(win => win.hide());

const tray: { appIcon: Tray | null } = { appIcon: null };

export const updateTray = (): void => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать',
      click: () => {
        // log.info(`Windows: ${[...windows].map(w => w.title).join(', ')}`);
        showAll();
      },
    },
    {
      label: 'Скрыть',
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
  tray.appIcon.on('click', () => showAll());
  tray.appIcon.setToolTip(import.meta.env.VITE_APP_NAME);
  updateTray();
});

export default tray;
