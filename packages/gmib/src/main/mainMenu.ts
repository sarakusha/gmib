/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { app, Menu, MenuItem, MenuItemConstructorOptions, shell } from 'electron';

const template: (MenuItemConstructorOptions | MenuItem)[] = [
  {
    role: 'editMenu' as any,
  },
  {
    role: 'viewMenu' as any,
  },
  {
    role: 'windowMenu' as any,
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'nibus.js',
        click: () => shell.openExternal('https://npm.nata-info.ru/#/detail/@nata/nibus.js'),
      },
    ],
  },
];

if (process.platform === 'darwin') {
  const name = app.getName();
  template.unshift({
    label: name,
    submenu: [
      {
        role: 'about',
      },
      {
        type: 'separator',
      },
      {
        role: 'services',
      },
      {
        type: 'separator',
      },
      {
        role: 'hide',
      },
      {
        role: 'hideothers',
      },
      {
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        role: 'quit',
      },
    ],
  });
}

const mainMenu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(mainMenu);
