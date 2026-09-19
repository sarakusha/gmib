import type { BrowserWindowConstructorOptions, Rectangle, WebContents } from 'electron';
import { app, BrowserWindow, ipcMain } from 'electron';

import type { Display as DisplayType } from '@nibus/core';
import debugFactory from 'debug';
import find from 'lodash/find';

import { DefaultDisplays, type PlayerMapping } from '/@common/video';

import getAllDisplays from './getAllDisplays';
import {
  isOutputHidden,
  isPlayerOutputHidden,
  setOutputHidden,
  setPlayerOutputHidden,
} from './outputVisibility';
import { reconcileOutputWindow } from './reconcileOutputWindow';
import { compareOutputWindowOrder } from './outputWindowOrder';
import { wss } from './server';
import {
  findManagedWindow,
  findParamsByWebContentsId,
  getAllScreenParams,
  getPlayerParams,
} from './windowStore';
import { broadcastToTabbedWindows } from './tabbedWindow';

type Handler = Parameters<WebContents['setWindowOpenHandler']>[0];
type AlwaysOnTopLevel = Parameters<BrowserWindow['setAlwaysOnTop']>[1];
type OutputWindowBounds = Pick<Rectangle, 'x' | 'y'> & Partial<Pick<Rectangle, 'width' | 'height'>>;
type OutputWindowConfig = {
  alwaysOnTop: boolean;
  bounds: OutputWindowBounds;
  isVideoOutput: boolean;
  kiosk: boolean;
  transparent: boolean;
  useNativeKiosk: boolean;
};

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:window`);
const TOPMOST_LEVEL: AlwaysOnTopLevel = 'screen-saver';
const OUTPUT_Z_ORDER_REFRESH_INTERVAL_MS = 30_000;

const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const configuredOutputUrls = new WeakMap<BrowserWindow, string>();

const getOutputWindowUrl = (window: BrowserWindow): string =>
  configuredOutputUrls.get(window) ?? window.webContents.getURL();

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
  return isVideoOutputWindowUrl(getOutputWindowUrl(window));
};

const getVideoOutputPlayer = (window: BrowserWindow): number | undefined => {
  if (!isVideoOutputWindow(window)) return undefined;
  try {
    const player = Number(new URL(getOutputWindowUrl(window)).searchParams.get('player'));
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

export const closePlayerOutputWindows = (playerId?: number): boolean => {
  const outputs = getPlayerOutputWindows(playerId);
  outputs.forEach(window => window.close());
  return outputs.length > 0;
};

const broadcastOutputVisibility = (hidden: boolean): void => {
  const message = JSON.stringify({ event: 'outputVisibility', hidden });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(message);
  });
  broadcastToTabbedWindows('outputVisibility', hidden);
};

const broadcastPlayerOutputVisibility = (playerId?: number): void => {
  const params = getPlayerParams().filter(
    player => playerId == null || player.playerId === playerId,
  );
  params.forEach(({ id, playerId: idOfPlayer }) => {
    const window = findManagedWindow(id);
    if (!window?.isDestroyed())
      window?.webContents.send('outputVisibility', isPlayerOutputHidden(idOfPlayer));
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

const hasCompleteBounds = (bounds: OutputWindowBounds): bounds is Rectangle =>
  Number.isFinite(bounds.width) && Number.isFinite(bounds.height);

const applyOutputWindowPlacement = (window: BrowserWindow, config: OutputWindowConfig): void => {
  const { bounds, useNativeKiosk } = config;
  if (useNativeKiosk) {
    window.setFocusable(true);
    window.setBounds(bounds, false);
    window.setFullScreen(true);
    window.setKiosk(true);
  } else if (hasCompleteBounds(bounds)) {
    window.setContentBounds(bounds, false);
  }
};

const getOutputWindowConfig = (url: string): OutputWindowConfig | undefined => {
  const parsedUrl = new URL(url);
  const { searchParams } = parsedUrl;
  if (!isOutputWindowUrl(url)) return undefined;

  const displays = getAllDisplays();
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
  if (!display) return undefined;

  const useNativeKiosk = kiosk && !isMacOS;
  const bounds = kiosk
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

  return {
    alwaysOnTop,
    bounds,
    isVideoOutput,
    kiosk,
    transparent,
    useNativeKiosk,
  };
};

const getVideoOutputZIndex = (window: BrowserWindow): number => {
  try {
    return toNumber(new URL(getOutputWindowUrl(window)).searchParams.get('zIndex'), 0);
  } catch {
    return 0;
  }
};

const getOutputWindowZIndex = (window: BrowserWindow): number => {
  if (isVideoOutputWindow(window)) return getVideoOutputZIndex(window);
  return getAllScreenParams().find(params => params.id === window.id)?.zIndex ?? 0;
};

export const arrangeOutputWindows = (): void => {
  getOutputWindows()
    .filter(window => !window.isDestroyed() && window.isVisible())
    .sort((a, b) =>
      compareOutputWindowOrder(
        {
          alwaysOnTop: shouldKeepOnTop(getOutputWindowUrl(a)),
          id: a.id,
          zIndex: getOutputWindowZIndex(a),
        },
        {
          alwaysOnTop: shouldKeepOnTop(getOutputWindowUrl(b)),
          id: b.id,
          zIndex: getOutputWindowZIndex(b),
        },
      ),
    )
    .forEach(window => {
      window.moveTop();
    });
};

const refreshOutputWindowStack = (): void => {
  getOutputWindows()
    .filter(window => !window.isDestroyed() && window.isVisible())
    .forEach(window => {
      if (shouldKeepOnTop(getOutputWindowUrl(window))) {
        window.setAlwaysOnTop(true, TOPMOST_LEVEL);
      }
    });
  arrangeOutputWindows();
};

if (isWindows) {
  const outputStackRefreshTimer = setInterval(
    refreshOutputWindowStack,
    OUTPUT_Z_ORDER_REFRESH_INTERVAL_MS,
  );
  outputStackRefreshTimer.unref();
}

const scheduleArrangeOutputWindows = (): void => {
  setTimeout(arrangeOutputWindows, 0);
};

const interactiveConfigured = new WeakSet<BrowserWindow>();

export const configureOutputWindowInteractivity = (window: BrowserWindow): void => {
  window.setIgnoreMouseEvents(false);
  if (interactiveConfigured.has(window)) return;
  interactiveConfigured.add(window);
  window.on('focus', scheduleArrangeOutputWindows);
  window.on('show', scheduleArrangeOutputWindows);
  window.on('restore', scheduleArrangeOutputWindows);
};

export const configureOutputWindow = (window: BrowserWindow, url: string): void => {
  if (!isOutputWindowUrl(url)) return;
  const config = getOutputWindowConfig(url);
  if (!config) return;
  configuredOutputUrls.set(window, url);
  const { isVideoOutput } = config;

  const keepOnTop = () => {
    if (window.isDestroyed()) return;
    window.setAlwaysOnTop(true, TOPMOST_LEVEL);
    scheduleArrangeOutputWindows();
  };

  window.setParentWindow(null);
  configureOutputWindowInteractivity(window);
  if (isMacOS) window.setFullScreenable(false);
  applyOutputWindowPlacement(window, config);
  if (isVideoOutput) {
    window.webContents.once('did-finish-load', () => {
      window.webContents.insertCSS(hideCursorCSS).catch(err => {
        debug(`error while insert cursor css: ${(err as Error).message}`);
      });
      scheduleArrangeOutputWindows();
    });
  }
  if (isWindowOutputHidden(window)) window.hide();
  else if (!window.isVisible()) {
    window.showInactive();
  }
  if (!shouldKeepOnTop(url)) {
    return;
  }

  keepOnTop();
  window.on('show', keepOnTop);
  window.on('restore', keepOnTop);
};

const isWindowOutputHidden = (window: BrowserWindow): boolean => {
  const playerId = getVideoOutputPlayer(window);
  return playerId == null ? isOutputHidden() : isPlayerOutputHidden(playerId);
};

export const getUnavailablePlayerOutputIds = (mappings: PlayerMapping[]): number[] =>
  mappings
    .filter(mapping => {
      const query = new URLSearchParams();
      Object.entries(mapping).forEach(([key, value]) => {
        if (value != null)
          query.set(key, typeof value === 'boolean' ? String(Number(value)) : String(value));
      });
      return !getOutputWindowConfig(`http://localhost/output/index.html?${query}`);
    })
    .map(({ id }) => id);

export const reconcilePlayerOutputWindows = (
  playerId: number,
): {
  hidden: boolean;
  unavailableOutputIds: number[];
  repaired: boolean;
} => {
  const hidden = isPlayerOutputHidden(playerId);
  const unavailableOutputIds: number[] = [];
  let repaired = false;
  getPlayerOutputWindows(playerId).forEach(window => {
    const url = getOutputWindowUrl(window);
    const config = getOutputWindowConfig(url);
    if (!config) {
      const id = toNumber(new URL(url).searchParams.get('id'));
      if (id != null) unavailableOutputIds.push(id);
    }
    const repairs = reconcileOutputWindow(window, config, hidden);
    if (repairs.length) {
      repaired = true;
      debug(
        'output-reconcile player=%d window=%d repairs=%s',
        playerId,
        window.id,
        repairs.join(','),
      );
    }
  });
  if (repaired) arrangeOutputWindows();
  return { hidden, unavailableOutputIds, repaired };
};

export const refreshPlayerOutputWindows = (): void => {
  const players = new Set(getPlayerOutputWindows().map(getVideoOutputPlayer));
  players.forEach(playerId => {
    if (playerId != null) reconcilePlayerOutputWindows(playerId);
  });
  getPlayerParams().forEach(({ id }) => {
    const playerWindow = findManagedWindow(id);
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.webContents.send('updateVideoOuts');
    }
  });
};

export const toggleOutputWindowsVisibility = (): boolean => {
  const outputs = getOutputWindows();
  if (outputs.length === 0) return false;
  const hidden = setOutputHidden(!isOutputHidden());
  outputs.forEach(window => {
    if (
      isWindowOutputHidden(window) ||
      (isVideoOutputWindow(window) && !getOutputWindowConfig(getOutputWindowUrl(window)))
    )
      window.hide();
    else window.show();
  });
  if (!hidden) {
    arrangeOutputWindows();
    outputs
      .filter(window => window.isVisible())
      .at(-1)
      ?.focus();
  }
  broadcastOutputVisibility(hidden);
  broadcastPlayerOutputVisibility();
  return true;
};

export const hideOutputWindows = (): boolean => {
  getOutputWindows().forEach(window => window.hide());
  broadcastOutputVisibility(setOutputHidden(true));
  broadcastPlayerOutputVisibility();
  return true;
};

export const setPlayerOutputWindowsVisibility = (visible: boolean, playerId?: number): boolean => {
  setPlayerOutputHidden(!visible, playerId);
  const outputs = getPlayerOutputWindows(playerId);
  outputs.forEach(window => {
    reconcileOutputWindow(
      window,
      getOutputWindowConfig(getOutputWindowUrl(window)),
      isWindowOutputHidden(window),
    );
  });
  if (visible) arrangeOutputWindows();
  broadcastPlayerOutputVisibility(playerId);
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
  // if (pathname !== '/output/index.html') return { action: 'deny' };
  // debug(`OPEN-HANDLER: ${JSON.stringify({ url, displays })}`);
  // console.log({ displays });
  const config = getOutputWindowConfig(url);
  if (!config) {
    debug(`${url} open denied`);
    return { action: 'deny' };
  }
  const { alwaysOnTop, bounds, isVideoOutput, transparent, useNativeKiosk } = config;
  const overrideBrowserWindowOptions: BrowserWindowConstructorOptions = {
    ...bounds,
    frame: false,
    useContentSize: !useNativeKiosk,
    backgroundColor: transparent ? undefined : '#000',
    focusable: useNativeKiosk || (isMacOS && isVideoOutput),
    fullscreen: useNativeKiosk,
    // simpleFullscreen: true,
    fullscreenable: useNativeKiosk,
    kiosk: useNativeKiosk,
    transparent,
    show: false,
    alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    ...(isWindows && { thickFrame: false }),
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
  ipcMain.handle('getOutputVisibility', event => {
    const params = findParamsByWebContentsId(event.sender.id);
    return params?.type === 'player' ? isPlayerOutputHidden(params.playerId) : isOutputHidden();
  });
});
