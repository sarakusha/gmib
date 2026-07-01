import type { BrowserWindowConstructorOptions, WebContents } from 'electron';
import { app, BrowserWindow, ipcMain } from 'electron';

import type { Display as DisplayType } from '@nibus/core';
import debugFactory from 'debug';
import find from 'lodash/find';

import { DefaultDisplays } from '/@common/video';

import getAllDisplays from './getAllDisplays';
import { isOutputHidden, setOutputHidden } from './outputVisibility';
import { wss } from './server';
import { findManagedWindow, getAllScreenParams, getPlayerParams } from './windowStore';
import { broadcastToTabbedWindows } from './tabbedWindow';

type Handler = Parameters<WebContents['setWindowOpenHandler']>[0];
type AlwaysOnTopLevel = Parameters<BrowserWindow['setAlwaysOnTop']>[1];

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:window`);
const TOPMOST_LEVEL: AlwaysOnTopLevel = 'screen-saver';

const isMacOS = process.platform === 'darwin';

const toNumber = <T extends number | undefined>(
  value: string | null,
  defaultValue?: T,
): number | T => {
  const result = value == null ? defaultValue : +value;
  return (Number.isNaN(result) ? defaultValue : result) as T;
};

const isOutputWindowUrl = (url: string) => {
  try {
    return new URL(url).pathname.startsWith('/output/');
  } catch {
    return false;
  }
};

const isVideoOutputWindowUrl = (url: string) => {
  try {
    return new URL(url).pathname === '/output/index.html';
  } catch {
    return false;
  }
};

const isVideoOutputWindow = (window: BrowserWindow): boolean => {
  if (window.isDestroyed()) return false;
  return isVideoOutputWindowUrl(window.webContents.getURL());
};

const getVideoOutputPlayer = (window: BrowserWindow): number | undefined => {
  if (!isVideoOutputWindow(window)) return undefined;
  try {
    const player = Number(new URL(window.webContents.getURL()).searchParams.get('player'));
    return Number.isInteger(player) ? player : undefined;
  } catch {
    return undefined;
  }
};

const getOutputWindows = (): BrowserWindow[] => {
  const videoOutputs = BrowserWindow.getAllWindows().filter(isVideoOutputWindow);
  const screenOutputs = getAllScreenParams()
    .map(({ id }) => findManagedWindow(id))
    .filter((window): window is BrowserWindow => window instanceof BrowserWindow)
    .filter(window => !window.isDestroyed());
  return [...new Set([...videoOutputs, ...screenOutputs])];
};

const getPlayerOutputWindows = (playerId?: number): BrowserWindow[] =>
  BrowserWindow.getAllWindows()
    .filter(isVideoOutputWindow)
    .filter(window => playerId == null || getVideoOutputPlayer(window) === playerId);

const broadcastOutputVisibility = (hidden: boolean): void => {
  const message = JSON.stringify({ event: 'outputVisibility', hidden });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(message);
  });
  broadcastToTabbedWindows('outputVisibility', hidden);
};

const broadcastPlayerOutputVisibility = (hidden: boolean, playerId?: number): void => {
  const params = getPlayerParams().filter(player => playerId == null || player.playerId === playerId);
  params.forEach(({ id }) => {
    const window = findManagedWindow(id);
    if (!window?.isDestroyed()) window?.webContents.send('outputVisibility', hidden);
  });
};

const hideCursorCSS = `
html.cursor-hidden,
html.cursor-hidden * {
  cursor: none !important;
}
`;

const shouldKeepOnTop = (url: string) => {
  if (isVideoOutputWindowUrl(url)) return true;
  try {
    const { searchParams } = new URL(url);
    return !!toNumber(searchParams.get('alwaysOnTop'), 1);
  } catch {
    return true;
  }
};

const getVideoOutputZIndex = (window: BrowserWindow): number => {
  try {
    return toNumber(new URL(window.webContents.getURL()).searchParams.get('zIndex'), 0);
  } catch {
    return 0;
  }
};

const getVideoOutputZOrder = (window: BrowserWindow): number => {
  try {
    return toNumber(new URL(window.webContents.getURL()).searchParams.get('zOrder'), 0);
  } catch {
    return 0;
  }
};

const getOutputWindowZIndex = (window: BrowserWindow): number => {
  if (isVideoOutputWindow(window)) return getVideoOutputZIndex(window);
  return getAllScreenParams().find(params => params.id === window.id)?.zIndex ?? 0;
};

const getOutputWindowZOrder = (window: BrowserWindow): number => {
  if (isVideoOutputWindow(window)) return getVideoOutputZOrder(window);
  return 0;
};

export const arrangeOutputWindows = (): void => {
  getOutputWindows()
    .filter(window => !window.isDestroyed() && window.isVisible())
    .sort((a, b) => {
      const aTop = shouldKeepOnTop(a.webContents.getURL()) ? 1 : 0;
      const bTop = shouldKeepOnTop(b.webContents.getURL()) ? 1 : 0;
      return (
        aTop - bTop ||
        getOutputWindowZIndex(a) - getOutputWindowZIndex(b) ||
        getOutputWindowZOrder(a) - getOutputWindowZOrder(b) ||
        a.id - b.id
      );
    })
    .forEach(window => {
      window.moveTop();
    });
};

const scheduleArrangeVideoOutputWindows = (): void => {
  setTimeout(arrangeOutputWindows, 0);
};

export const configureOutputWindow = (window: BrowserWindow, url: string): void => {
  if (!isOutputWindowUrl(url)) return;
  const isVideoOutput = isVideoOutputWindowUrl(url);

  const keepOnTop = () => {
    if (window.isDestroyed()) return;
    window.setAlwaysOnTop(true, TOPMOST_LEVEL);
    window.moveTop();
    scheduleArrangeVideoOutputWindows();
  };

  window.setParentWindow(null);
  if (isMacOS) window.setFullScreenable(false);
  if (isVideoOutput) {
    window.webContents.once('did-finish-load', () => {
      window.webContents.insertCSS(hideCursorCSS).catch(err => {
        debug(`error while insert cursor css: ${(err as Error).message}`);
      });
    });
  }
  if (isOutputHidden()) window.hide();
  else if (!window.isVisible()) {
    window.showInactive();
    if (isVideoOutput) scheduleArrangeVideoOutputWindows();
  }
  if (!shouldKeepOnTop(url)) {
    if (isVideoOutput) {
      window.on('show', scheduleArrangeVideoOutputWindows);
      window.on('restore', scheduleArrangeVideoOutputWindows);
    }
    return;
  }

  keepOnTop();
  window.on('show', keepOnTop);
  window.on('restore', keepOnTop);
};

export const toggleOutputWindowsVisibility = (): boolean => {
  const outputs = getOutputWindows();
  if (outputs.length === 0) return false;

  const visible = outputs.filter(window => window.isVisible());
  if (visible.length > 0) {
    visible.forEach(window => window.hide());
    broadcastOutputVisibility(setOutputHidden(true));
    return true;
  }

  outputs.forEach(window => {
    window.show();
  });
  arrangeOutputWindows();
  outputs.at(-1)?.focus();
  broadcastOutputVisibility(setOutputHidden(false));
  return true;
};

export const hideOutputWindows = (): boolean => {
  const outputs = getOutputWindows();
  outputs.forEach(window => window.hide());
  broadcastOutputVisibility(setOutputHidden(true));
  return true;
};

export const setPlayerOutputWindowsVisibility = (visible: boolean, playerId?: number): boolean => {
  const outputs = getPlayerOutputWindows(playerId);
  outputs.forEach(window => {
    if (visible) window.showInactive();
    else window.hide();
  });
  if (visible) arrangeOutputWindows();
  broadcastPlayerOutputVisibility(!visible, playerId);
  return outputs.length > 0;
};

export const isOutputWindowsHidden = isOutputHidden;

export const installWindowOpenHandler = (contents: WebContents): void => {
  contents.setWindowOpenHandler(openHandler);
  contents.on('did-create-window', (window, { url }) => {
    configureOutputWindow(window, url);
  });
};

const openHandler: Handler = ({ url }) => {
  const parsedUrl = new URL(url);
  const { searchParams } = parsedUrl;
  // if (pathname !== '/output/index.html') return { action: 'deny' };
  const displays = getAllDisplays();
  // debug(`OPEN-HANDLER: ${JSON.stringify({ url, displays })}`);
  // console.log({ displays });
  const displayParam = searchParams.get('display');
  const displayId = toNumber(displayParam);
  const x = toNumber(searchParams.get('left'), 0);
  const y = toNumber(searchParams.get('top'), 0);
  const width = toNumber(searchParams.get('width'));
  const height = toNumber(searchParams.get('height'));
  const kiosk = !!toNumber(searchParams.get('kiosk'), 0);
  const transparent = !!toNumber(searchParams.get('transparent'), 0);
  const isVideoOutput = parsedUrl.pathname === '/output/index.html';
  const alwaysOnTop = isVideoOutput || !!toNumber(searchParams.get('alwaysOnTop'), 1);
  let display: DisplayType | undefined;
  switch (displayId) {
    case DefaultDisplays.Primary:
      display = find(displays, { primary: true });
      break;
    case DefaultDisplays.Secondary:
      display = find(displays, { primary: false });
      break;
    default:
      if (Number.isInteger(displayId)) {
        display = find(displays, { id: displayId });
      }
  }
  if (!display) {
    debug(`${url} open denied`);
    return { action: 'deny' };
  }
  const useNativeKiosk = kiosk && !isMacOS;
  const windowBounds = kiosk
    ? {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      }
    : {
        x: x + display.bounds.x,
        y: y + display.bounds.y,
        width,
        height,
      };
  const overrideBrowserWindowOptions: BrowserWindowConstructorOptions = {
    ...windowBounds,
    frame: false,
    backgroundColor: transparent ? undefined : '#000',
    focusable: isMacOS && isVideoOutput,
    // fullscreen: kiosk,
    // simpleFullscreen: true,
    fullscreenable: false,
    kiosk: useNativeKiosk,
    transparent,
    show: false,
    alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    webPreferences: {
      // nativeWindowOpen: true,
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like iframe or Electron's BrowserView. https://www.electronjs.org/docs/latest/api/webview-tag#warning
      backgroundThrottling: false,
      zoomFactor: 1,
    },
  };
  // console.log(overrideBrowserWindowOptions);
  return { action: 'allow', overrideBrowserWindowOptions };
};

export default openHandler;

void app.whenReady().then(() => {
  ipcMain.handle('getOutputVisibility', isOutputWindowsHidden);
});
