import { app, BrowserWindow, ipcMain } from 'electron';

import debugFactory from 'debug';
import pick from 'lodash/pick';

import type { Screen } from '/@common/video';

import getAnnounce from './getAnnounce';

import type {
  GmibWindowParams,
  PlayerWindowParams,
  ScreenOptions,
  ScreenWindowParams,
  WindowParams,
} from '/@common/WindowParams';
import { gmibVariables, impScreenProps, isGmib, isPlayer, isScreen } from '/@common/WindowParams';

export const licenseNames = ['basic', 'standard', 'plus', 'premium', 'enterprise'] as const;

export type LicenseName = (typeof licenseNames)[number];

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:windowStore`);

// const defaultConfig = parse('{}') as LocalConfig;

const store = new Map<number, WindowParams>();

const register = (browserWindow: BrowserWindow): number => {
  const { id } = browserWindow;
  if (!store.has(id)) {
    browserWindow.once('closed', () => store.delete(id));
  }
  return id;
};

export const registerGmib = async (
  browserWindow: BrowserWindow,
  { host, nibusPort: port }: Pick<GmibWindowParams, 'host' | 'nibusPort'>,
): Promise<GmibWindowParams> => {
  const id = register(browserWindow);
  // console.log('REGISTER', browserWindow.id);
  // debug(`register gmib: ${id}`);
  const params: GmibWindowParams = {
    id,
    type: 'gmib',
    host,
    nibusPort: port,
    update: values => {
      const result = Object.assign(params, pick(values, gmibVariables));
      const { update, ...props } = result;
      browserWindow.webContents.send('gmib-params', props);
      return result;
    },
  };
  const announce = await getAnnounce(host, port + 1);
  if (typeof announce === 'object') {
    const { message, ...data } = announce;
    Object.assign(params, data);
    if (message) {
      const announceWindow = () => {
        const { update, ...props } = params;
        browserWindow.webContents.send('gmib-params', props);
        import.meta.env.VITE_ANNOUNCE_HOST &&
          import(import.meta.env.VITE_ANNOUNCE_HOST).then(
            ({ default: getHost }) => {
              const hostWindow = getHost(browserWindow);
              const dateAnnounce = getHost(data)(import.meta.env.VITE_ANNOUNCE_DATE);
              if (new Date().toISOString() <= dateAnnounce) {
                hostWindow(import.meta.env.VITE_ANNOUNCE_WINDOW).bind(
                  hostWindow(import.meta.env.VITE_ANNOUNCE_BIND),
                )(message);
              }
            },
            err => {
              debug(`error while import: ${err}`);
            },
          );
      };
      browserWindow.webContents.on('did-finish-load', announceWindow);
      if (!browserWindow.webContents.isLoading()) announceWindow();
    }
  }
  store.set(id, params);
  return params;
};

export const registerScreen = (browserWindow: BrowserWindow, scr: Screen) => {
  const id = register(browserWindow);
  const {
    test,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
    width,
    height,
    moduleWidth,
    moduleHeight,
  }: ScreenOptions = scr;
  const params: ScreenWindowParams = {
    id,
    type: 'screen',
    screenId: scr.id,
    test,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
    width,
    height,
    moduleWidth,
    moduleHeight,
  };
  store.set(id, params);
};

export const registerPlayer = (
  browserWindow: BrowserWindow,
  { playerId, host, port }: Pick<PlayerWindowParams, 'playerId' | 'host' | 'port'>,
): number => {
  const id = register(browserWindow);
  store.set(id, { id, type: 'player', playerId, host, port });
  return id;
};

export const getGmibParams = () => [...store.values()].filter(isGmib);

export const getScreenParams = () => [...store.values()].filter(isScreen);

export const isEqualOptions = (a: ScreenOptions, b: ScreenOptions): boolean =>
  impScreenProps.reduce((res, key) => res && a[key] === b[key], true);

export const createSearchParams = <T extends ScreenOptions>(options: T): URLSearchParams =>
  new URLSearchParams(
    impScreenProps.reduce<[string, string][]>((res, key) => {
      const value = options[key];
      return value != null ? [...res, [key, value.toString()]] : res;
    }, []),
  );

export const findScreenParams = (screenId: number): ScreenWindowParams | undefined =>
  getScreenParams().find(item => item.screenId === screenId);
export const findScreenWindow = (screenId: number): BrowserWindow | undefined => {
  const params = findScreenParams(screenId);
  return params && (BrowserWindow.fromId(params.id) ?? undefined);
};

export const getPlayerParams = () => [...store.values()].filter(isPlayer);

export const findPlayerParams = (
  playerId: number,
  host = 'localhost',
): PlayerWindowParams | undefined =>
  getPlayerParams().find(item => item.playerId === playerId && item.host === host);
export const findPlayerWindow = (
  playerId: number,
  host = 'localhost',
): BrowserWindow | undefined => {
  const params = findPlayerParams(playerId, host);
  return params && (BrowserWindow.fromId(params.id) ?? undefined);
};

export default store as ReadonlyMap<number, WindowParams>;

app.whenReady().then(() => {
  ipcMain.handle('getParams', async (event, name: keyof WindowParams) => {
    const id = BrowserWindow.fromWebContents(event.sender)?.id;
    if (id && store.has(id)) {
      const params = store.get(id);
      return params?.[name];
    }
    return undefined;
  });
});
