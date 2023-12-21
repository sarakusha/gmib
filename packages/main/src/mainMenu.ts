import { notEmpty } from '/@common/helpers';

import type { MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';

// import debugFactory from 'debug';
import type { UpdateInfo } from 'electron-updater';
import uniqBy from 'lodash/uniqBy';
import semverGt from 'semver/functions/gte';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';

import localConfig from './localConfig';
import { linuxAutostart } from './linux';
import { updateTray } from './tray';
import { openPlayer } from './playerWindow';
import { hasPlayers, insertPlayer, uniquePlayerName } from './screen';
import { dbReady } from './db';
import checkForUpdates from './updater';
// import type { WindowParams } from './windowStore';
import store, { getAllGmibParams } from './windowStore';
import authRequest from './authRequest';
import mdnsBrowser, { pickRemoteService } from './mdns';
import { createAppWindow, getMainWindow } from './mainWindow';

import type { GmibWindowParams, WindowParams } from '/@common/WindowParams';
import { isGmib, isPlayer } from '/@common/WindowParams';
import type { Player } from '/@common/video';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:menu`);

const getGmibParams = (params?: WindowParams): GmibWindowParams | undefined => {
  if (isGmib(params)) return params;
  if (isPlayer(params)) return params.parent;
  return undefined;
};

const createNewPlayer = async (name = 'Новый плеер'): Promise<number> => {
  await dbReady;
  const player = await uniquePlayerName({ name });
  const { lastID } = await insertPlayer(player);
  // await openPlayer(lastID);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  updateMenu();
  return lastID;
};

type AppMenuItem = Omit<MenuItemConstructorOptions, 'submenu'> & {
  submenu: MenuItemConstructorOptions[];
};

// const playerMenu: AppMenuItem = {
//   label: 'Плеер',
//   submenu: [],
// };

const playerSubmenu = async (params: GmibWindowParams): Promise<MenuItemConstructorOptions[]> => {
  try {
    const res = await authRequest({
      api: '/player',
      host: params.host,
      port: params.nibusPort + 1,
    });
    if (!res?.ok) return [];
    const players = (await res.json()) as Player[];
    return players.map<MenuItemConstructorOptions>(({ id, name }) => ({
      label: name ?? `player#${id}`,
      click: () => {
        openPlayer(id, { gmibParams: params });
      },
    }));
  } catch (error) {
    console.error('error while fetch players', error);
    return playerSubmenu(params);
  }
};

const findGmib = (host: string): GmibWindowParams | undefined =>
  getAllGmibParams().find(item => item.host === host);

const paramsToRemote = (params: GmibWindowParams) => ({
  address: params.host,
  port: params.nibusPort,
  name: params.info?.name,
});

const remoteMenu = (params?: WindowParams): AppMenuItem | undefined => {
  const gmibParams = getGmibParams(params);
  if (!gmibParams) return undefined;
  const self = paramsToRemote(gmibParams);
  const local = findGmib('localhost');
  const focused = BrowserWindow.getFocusedWindow()?.id;
  const remotes = isGmib(params)
    ? uniqBy(
        [
          ...(local ? [paramsToRemote(local)] : []),
          ...mdnsBrowser.services.map(pickRemoteService).filter(notEmpty),
          ...sortBy(localConfig.get('hosts'), ['name', 'address']),
        ],
        'address',
      )
    : [self];
  const links = remotes.map(
    ({ address, port, name }): MenuItemConstructorOptions => ({
      label: name ? `${name} (${address})` : address,
      type: 'checkbox',
      checked: focused ? findGmib(address)?.id === focused : false,
      click: () => {
        const gmib = findGmib(address);
        if (gmib) {
          const window = BrowserWindow.fromId(gmib.id);
          if (window) {
            window.show();
            window.focus();
            return;
          }
        }
        const window = createAppWindow(port, address, name);
        // registerGmib(window, { host: address, nibusPort: +port });
        window.show();
        window.focus();
      },
    }),
  );
  return {
    label: 'GMIB',
    submenu: isGmib(params)
      ? [
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
          ...links,
        ]
      : links,
  };
};

const helpMenu = async (params?: WindowParams): Promise<AppMenuItem> => {
  // console.log(`MENU: ${JSON.stringify(params)}`);

  const gmibParams = getGmibParams(params);
  const isModernGmib = gmibParams?.info?.version && semverGt(gmibParams.info.version, '4.2.1');

  return {
    label: 'Помощь',
    role: 'help',
    submenu: [
      ...(isModernGmib
        ? [
            {
              label: 'Лицензия',
              submenu: [
                ...(gmibParams.plan ? [{ label: `Тип: ${gmibParams.plan}`, enabled: false }] : []),
                ...(gmibParams.key
                  ? [
                      {
                        label: `Ключ: ${gmibParams.key
                          .split('-')
                          .map(str => str.replace(/.$/, '?'))
                          .join('-')}`,
                        enabled: false,
                      },
                    ]
                  : []),
                ...(gmibParams.renew
                  ? [
                      {
                        label: `Действительна по: ${new Date(
                          gmibParams.renew,
                        ).toLocaleDateString()}`,
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
        click: () => shell.openExternal('https://app.nata-info.ru/gmib/releases'),
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
                  host: gmibParams.host,
                  port: gmibParams.nibusPort + 1,
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
                host: gmibParams.host,
                port: gmibParams.nibusPort + 1,
              });
              if (!res) return;
              if (res.ok) {
                const info = (await res.json()) as undefined | UpdateInfo;
                if (info) {
                  dialog
                    .showMessageBox({
                      type: 'info',
                      title: 'Найдено обновление',
                      message: `Найдено обновление ${info.version} для ${gmibParams.host}, хотите установить?`,
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
              click: () =>
                authRequest({
                  api: '/relaunch',
                  method: 'POST',
                  host: gmibParams.host,
                  port: gmibParams.nibusPort + 1,
                }),
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
    ...((isGmib(params) &&
      params.plan &&
      ['plus', 'premium', 'enterprise'].includes(params.plan)) ||
    isPlayer(params)
      ? // params.host === 'localhost'
        [{ label: 'Плееры', submenu: await playerSubmenu(isGmib(params) ? params : params.parent) }]
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

let menuReady = Promise.resolve();
const update = async () => {
  const win = BrowserWindow.getFocusedWindow();
  const id = win?.id;
  const params = id ? store.get(id) : undefined;
  const tmpl = await template(params);
  const mainMenu = Menu.buildFromTemplate(tmpl);
  if (['win32', 'linux'].includes(process.platform)) win?.setMenu(mainMenu);
  else Menu.setApplicationMenu(mainMenu);
};

const updateMenu = debounce((): void => {
  menuReady = menuReady.finally().then(update);
}, 250);

const blurWindows: BrowserWindow[] = [];

app.on('browser-window-focus', (_, win) => {
  win.webContents.send('focus', true);
  const wins = blurWindows.splice(0, blurWindows.length);
  wins.forEach(item => win !== item && item.webContents.send('focus', false));
  updateMenu();
});

app.on('browser-window-blur', (_, win) => {
  // win.webContents.send('focus', false);
  blurWindows.push(win);
});

localConfig.onDidChange('autostart', (autostart = false) => {
  app.setLoginItemSettings({
    openAtLogin: autostart,
    openAsHidden: true,
  });
  linuxAutostart(autostart);
  updateMenu();
  updateTray();
  getAllGmibParams()
    .find(({ host }) => host === 'localhost')
    ?.update({ autostart });
});

localConfig.onDidChange('hosts', updateMenu);
localConfig.onDidChange('autostart', updateMenu);
mdnsBrowser.on('up', updateMenu);
mdnsBrowser.on('down', updateMenu);

dbReady.then(hasPlayers).then(async res => res || (await createNewPlayer('Плеер')));

export default updateMenu;
