import type { RemoteHost } from '/@common/helpers';
import { getRemoteLabel } from '/@common/helpers';

import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { app, Menu, shell } from 'electron';

import windows from './windows';
import localConfig from './localConfig';
import { linuxAutostart } from './linux';
import { updateTray } from './tray';

const SessionsLabel = 'NiBUS сессии';

const template: MenuItemConstructorOptions[] = [
  {
    label: SessionsLabel,
    submenu: [
      {
        label: 'Автозапуск',
        type: 'checkbox',
        click: mi => {
          localConfig.set('autostart', mi.checked);
        },
        checked: localConfig.get('autostart'),
      },
      { label: 'Изменить список ...' },
      { type: 'separator' },
    ],
  },
  {
    label: 'Правка',
    role: 'editMenu',
    submenu: [
      {
        label: 'Отменить',
        // accelerator: 'CmdOrCtrl+Z',
        role: 'undo',
      },
      {
        label: 'Повторить',
        // accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo',
      },
      {
        type: 'separator',
      },
      {
        label: 'Вырезать',
        // accelerator: 'CmdOrCtrl+X',
        role: 'cut',
      },
      {
        label: 'Копировать',
        // accelerator: 'CmdOrCtrl+C',
        role: 'copy',
      },
      {
        label: 'Вставить',
        // accelerator: 'CmdOrCtrl+V',
        role: 'paste',
      },
      {
        label: 'Выделить все',
        // accelerator: 'CmdOrCtrl+A',
        role: 'selectAll',
      },
    ],
  },
  {
    label: 'Вид',
    role: 'viewMenu',
    submenu: [
      {
        label: 'Обновить',
        // accelerator: 'CmdOrCtrl+R',
        role: 'reload',
        // click: (item, focusedWindow) => {
        //   if (focusedWindow) focusedWindow.reload();
        // },
      },
      {
        label: 'Полноэкранный режим',
        role: 'togglefullscreen',
        // accelerator: (function () {
        //   if (process.platform === 'darwin') return 'Ctrl+Command+F';
        //   else return 'F11';
        // })(),
        // click: function (item, focusedWindow) {
        //   if (focusedWindow) focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        // },
      },
      {
        label: 'Инструменты разработчика',
        role: 'toggleDevTools',
        // accelerator: (function () {
        //   if (process.platform === 'darwin') return 'Alt+Command+I';
        //   else return 'Ctrl+Shift+I';
        // })(),
        // click: function (item, focusedWindow) {
        //   if (focusedWindow) focusedWindow.toggleDevTools();
        // },
      },
      {
        type: 'separator',
      },
      {
        label: 'Актуальный размер',
        role: 'resetZoom',
      },
      {
        label: 'Увеличить',
        role: 'zoomIn',
      },
      {
        label: 'Уменьшить',
        role: 'zoomOut',
      },
    ],
  },
  {
    label: 'Окно',
    role: 'windowMenu',
    submenu: [
      {
        label: 'Минимизировать',
        // accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        label: 'Закрыть',
        // accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
    ],
  },
  // { role: 'viewMenu' },
  // { role: 'editMenu' },
  // { role: 'windowMenu' },
  {
    label: 'Помощь',
    role: 'help',
    submenu: [
      {
        label: 'nibus.js',
        click: () => shell.openExternal('https://github.com/sarakusha/nibus'),
      },
    ],
  },
];

if (process.platform === 'darwin') {
  template.unshift({
    label: import.meta.env.VITE_APP_NAME,
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
        role: 'hideOthers',
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

const getRemoteSub = (): MenuItemConstructorOptions[] | undefined =>
  template.find(menu => menu.label === SessionsLabel)?.submenu as MenuItemConstructorOptions[];

export const updateMenu = (): void => {
  const sub = getRemoteSub();
  if (sub && sub.length > 0) sub[0].checked = localConfig.get('autostart');
  const mainMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(mainMenu);
};

app.whenReady().then(updateMenu);

export type CreateWindow = (port?: number, host?: string) => Promise<BrowserWindow>;

export const getTitle = (port: number, host?: string): string =>
  `${import.meta.env.VITE_APP_NAME} - ${host || 'localhost'}:${port}`;

const remoteClick =
  (create: CreateWindow): Exclude<MenuItemConstructorOptions['click'], undefined> =>
  async menuItem => {
    const [host, port] = menuItem.label.split(':');
    let window = [...windows.values()].find(w => w.title === getTitle(+port, host));
    if (!window) {
      window = await create(+port, host === 'localhost' ? undefined : host);
    }
    window.show();
    window.focus();
  };

export const addRemoteFactory =
  (create: CreateWindow) =>
  (port?: number, address?: string, update = true): void => {
    const label = getRemoteLabel(port, address);
    const sub = getRemoteSub();
    if (!sub) return;
    if (sub.findIndex(item => item.label === label) === -1) {
      sub.push({ label, click: remoteClick(create) });
      update && updateMenu();
    }
  };

export const removeRemote = ({ port, address }: RemoteHost): void => {
  const label = getRemoteLabel(port, address);
  const sub = getRemoteSub();
  if (!sub) return;
  const index = sub.findIndex(item => item.label === label);
  if (index !== -1) {
    sub.splice(index, 1);
    updateMenu();
  }
};

export const setRemoteEditClick = (click: () => void): void => {
  const sub = getRemoteSub();
  if (sub && sub.length > 1) sub[1].click = click;
  updateMenu();
};

export const setRemotesFactory =
  (create: CreateWindow) =>
  (remotes: { port: number; address: string }[]): void => {
    const addRemote = addRemoteFactory(create);
    const sub = getRemoteSub();
    sub && sub.splice(4, sub.length);
    remotes.forEach(({ port, address }) => addRemote(port, address, false));
    updateMenu();
  };

localConfig.onDidChange('autostart', (autostart = false) => {
  // debug(`autostart: ${autostart}`);
  app.setLoginItemSettings({
    openAtLogin: autostart,
    openAsHidden: true,
  });
  linuxAutostart(autostart);
  updateMenu();
  updateTray();
});
