/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { app, Menu, Tray } from 'electron';

import path from 'path';
import localConfig from '../util/localConfig';
import { hideAll, showAll } from './windows';

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
    { type: 'separator' },
    { role: 'quit', label: 'Выход' },
  ]);
  tray && tray.appIcon?.setContextMenu(contextMenu);
};
app.whenReady().then(() => {
  tray.appIcon = new Tray(
    process.platform !== 'win32'
      ? path.resolve(__dirname, '../extraResources/icon16x16.png')
      : path.resolve(__dirname, '../extraResources/icon.ico')
  );
  tray.appIcon.on('click', () => showAll());
  tray.appIcon.setToolTip('gmib');
  updateTray();
});

export default tray;
