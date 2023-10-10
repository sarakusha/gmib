import { notEmpty } from '/@common/helpers';

import type { MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';

// import debugFactory from 'debug';
import type { UpdateInfo } from 'electron-updater';
import uniqBy from 'lodash/uniqBy';
import semverGt from 'semver/functions/gte';

import localConfig from './localConfig';
import { linuxAutostart } from './linux';
import { updateTray } from './tray';
import { openPlayer } from './playerWindow';
import { getPlayers, hasPlayers, insertPlayer, uniquePlayerName } from './screen';
import { dbReady } from './db';
import checkForUpdates from './updater';
// import type { WindowParams } from './windowStore';
import store, { getGmibParams, registerGmib } from './windowStore';
import authRequest from './authRequest';
import mdnsBrowser, { pickRemoteService } from './mdns';
import { createAppWindow, getMainWindow } from './mainWindow';
import relaunch from './relaunch';

import type { WindowParams } from '/@common/WindowParams';
import { isGmib } from '/@common/WindowParams';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:menu`);

const createNewPlayer = async (name = 'Новый плеер'): Promise<void> => {
  await dbReady;
  const player = await uniquePlayerName({ name });
  /* const { lastID } = */ await insertPlayer(player);
  // await openPlayer(lastID);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  updateMenu();
};

type AppMenuItem = Omit<MenuItemConstructorOptions, 'submenu'> & {
  submenu: MenuItemConstructorOptions[];
};

const playerMenu: AppMenuItem = {
  label: 'Плеер',
  submenu: [],
};

const playerSubmenu = async (): Promise<MenuItemConstructorOptions[]> => {
  await dbReady;
  const players = await getPlayers();
  return players.map<MenuItemConstructorOptions>(({ id, name }) => ({
    label: name ?? `player#${id}`,
    click: () => {
      openPlayer(id);
    },
  }));
};

const remoteMenu = (params?: WindowParams): AppMenuItem | undefined => {
  const remotes = uniqBy(
    [...mdnsBrowser.services.map(pickRemoteService).filter(notEmpty), ...localConfig.get('hosts')],
    'address',
  );
  return isGmib(params)
    ? {
      label: 'GMIB',
      submenu: [
        {
          label: 'Автозапуск',
          type: 'checkbox',
          click: async () => {
            const value = !params.autostart;
            try {
              const res = await authRequest({
                api: '/autostart',
                method: 'POST',
                host: params.host,
                port: params.nibusPort + 1,
                body: { value },
              });
              if (res?.ok) {
                params.update({ autostart: value });
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                updateMenu();
              }
            } catch (e) {
              console.error(`error while fetch: ${e}`);
            }
          },
          checked: params.autostart,
        },
        {
          label: 'Изменить список ...',
          click: () => {
            const window = getMainWindow();
            if (window) {
              window.show();
              window.focus();
              window.webContents.send('editRemoteHosts');
            }
          },
        },
        { type: 'separator' },
        ...remotes.map(
          ({ address, port, name }): MenuItemConstructorOptions => ({
            label: name ? `${name} (${address})` : address,
            click: () => {
              const gmib = getGmibParams().find(
                item => item.host === address && item.nibusPort === port,
              );
              if (gmib) {
                const window = BrowserWindow.fromId(gmib.id);
                if (window) {
                  window.show();
                  window.focus();
                  return;
                }
              }
              const window = createAppWindow(port, address, name);
              registerGmib(window, { host: address, nibusPort: +port });
              window.show();
              window.focus();
            },
          }),
        ),
      ],
    }
    : undefined;
};

const helpMenu = async (params?: WindowParams): Promise<AppMenuItem> => {
  // console.log(`MENU: ${JSON.stringify(params)}`);
  const isModernGmib =
    isGmib(params) && params.info?.version && semverGt(params.info.version, '4.2.1');
  return {
    label: 'Помощь',
    role: 'help',
    submenu: [
      ...(isModernGmib
        ? [
          {
            label: 'Лицензия',
            submenu: [
              ...(params.plan ? [{ label: `Тип: ${params.plan}`, enabled: false }] : []),
              ...(params.key ? [{ label: `Ключ: ${params.key}`, enabled: false }] : []),
              ...(params.renew
                ? [
                  {
                    label: `Действительна по: ${new Date(params.renew).toLocaleDateString()}`,
                    enabled: false,
                  },
                ]
                : []),
              {
                label: 'Активировать лицензию',
                click: () =>
                  BrowserWindow.getFocusedWindow()?.webContents.send('activateLicense'),
              },
            ],
          },
        ]
        : []),
      {
        label: 'Все версии',
        click: () => shell.openExternal('https://github.com/sarakusha/gmib/releases'),
      },
      {
        label: 'Проверить обновления',
        // enabled: import.meta.env.PROD,
        click: isModernGmib
          ? async () => {
            const updateAndRestart = async () => {
              const resp = await authRequest({
                api: '/update',
                method: 'POST',
                host: params.host,
                port: params.nibusPort + 1,
              });
              if (!resp) return;
              if (resp.ok) {
                dialog.showMessageBox({
                  title: 'Обновление установлено',
                  message: 'Программа перезапущена',
                });
              } else {
                dialog.showErrorBox('Что-то пошло не так', await resp.text());
              }
            };
            const res = await authRequest({
              api: '/checkForUpdates',
              method: 'POST',
              host: params.host,
              port: params.nibusPort + 1,
            });
            if (!res) return;
            if (res.ok) {
              const info = (await res.json()) as undefined | UpdateInfo;
              if (info) {
                dialog
                  .showMessageBox({
                    type: 'info',
                    title: 'Найдено обновление',
                    message: `Найдено обновление ${info.version} для ${params.host}, хотите установить?`,
                    buttons: ['Установить', 'Не сейчас'],
                  })
                  .then(buttonIndex => {
                    if (buttonIndex.response === 0) updateAndRestart();
                  });
              } else {
                dialog.showMessageBox({
                  title: 'Обновления не найдены',
                  message: 'Установлена последняя версия',
                });
              }
            } else {
              dialog.showErrorBox('Что-то пошло не так', await res.text());
            }
          }
          : checkForUpdates,
      },
      ...(isModernGmib
        ? [
          {
            label: 'Перезапустить',
            click: relaunch,
            enabled: import.meta.env.PROD,
          },
        ]
        : []),
    ],
  };
};

const template = async (params?: WindowParams): Promise<MenuItemConstructorOptions[]> => {
  const remote = remoteMenu(params);
  return [
    ...(process.platform === 'darwin'
      ? [
        {
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
        } as MenuItemConstructorOptions,
      ]
      : []),
    ...(remote ? [remote] : []),
    ...(isGmib(params) && params.plan && ['premium', 'enterprise'].includes(params.plan) && params.host === 'localhost'
      ? [{ label: 'Плеер', submenu: await playerSubmenu() }]
      : []),
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
    await helpMenu(params),
  ];
};

// if (process.platform === 'darwin') {
//   template.unshift({
//     label: import.meta.env.VITE_APP_NAME,
//     submenu: [
//       {
//         role: 'about',
//       },
//       {
//         type: 'separator',
//       },
//       {
//         role: 'services',
//       },
//       {
//         type: 'separator',
//       },
//       {
//         role: 'hide',
//       },
//       {
//         role: 'hideOthers',
//       },
//       {
//         role: 'unhide',
//       },
//       {
//         type: 'separator',
//       },
//       {
//         role: 'quit',
//       },
//     ],
//   });
// }

const updateMenu = (): Promise<void> =>
  new Promise(resolve => {
    const id = BrowserWindow.getFocusedWindow()?.id;
    if (id && !store.has(id)) {
      setTimeout(() => resolve(updateMenu()), 50);
    } else {
      const params = id !== undefined ? store.get(id) : undefined;
      template(params).then(tmpl => {
        const mainMenu = Menu.buildFromTemplate(tmpl);
        Menu.setApplicationMenu(mainMenu);
        resolve();
      });
    }
  });

app.on('browser-window-focus', updateMenu);

localConfig.onDidChange('autostart', (autostart = false) => {
  app.setLoginItemSettings({
    openAtLogin: autostart,
    openAsHidden: true,
  });
  linuxAutostart(autostart);
  updateMenu();
  updateTray();
  getGmibParams()
    .find(({ host }) => host === 'localhost')
    ?.update({ autostart });
});

localConfig.onDidChange('hosts', updateMenu);
mdnsBrowser.on('up', updateMenu);
mdnsBrowser.on('down', updateMenu);

dbReady.then(hasPlayers).then(async res => res || (await createNewPlayer('Плеер')));

export default updateMenu;
