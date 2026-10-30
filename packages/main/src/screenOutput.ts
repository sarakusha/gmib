import type { Display } from 'electron';
import { BrowserWindow, screen } from 'electron';

import debugFactory from 'debug';

import type { Screen } from '/@common/video';
import { DefaultDisplays } from '/@common/video';
import { findById } from '/@common/helpers';

import { port } from './config';
import machineId from './machineId';
import { getLicenseState } from './licenseState';
import { createTestWindow } from './mainWindow';
import { arrangeOutputWindows, configureOutputWindowInteractivity } from './openHandler';
import { getPage } from './page';
import { getScreen } from './screen';
import { isScreenOutputHidden } from './outputVisibility';
import {
  createSearchParams,
  findScreenParams,
  isEqualOptions,
  registerScreen,
} from './windowStore';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:screenOutput`);

const hideCursorCSS = `html, body {
  cursor: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=), none;
  user-select: none;
}`;

const transparentOutputCSS = `html, body {
  background: transparent !important;
  background-color: transparent !important;
}`;

const isLoadAborted = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('ERR_ABORTED');

const pendingUpdates = new Map<number, Promise<void>>();
const loadErrors = new WeakMap<BrowserWindow, string>();

export const getScreenOutputError = (screenId: number): string | undefined => {
  const params = findScreenParams(screenId);
  const window = params && BrowserWindow.fromId(params.id);
  return window && !window.isDestroyed() ? loadErrors.get(window) : undefined;
};

const queueUpdate = (id: number, work: () => Promise<void>): Promise<void> => {
  const previous = pendingUpdates.get(id) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  pendingUpdates.set(id, current);
  const cleanup = () => {
    if (pendingUpdates.get(id) === current) pendingUpdates.delete(id);
  };
  void current.then(cleanup, cleanup);
  return current;
};

const updateTestImpl = async (scr: Screen, force = false): Promise<void> => {
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  const { id } = scr;
  const prev = findScreenParams(id);
  const win = prev && BrowserWindow.fromId(prev.id);
  let display: Display | undefined;
  if (!scr.width || !scr.height) {
    win?.close();
    return;
  }
  switch (scr.display) {
    case DefaultDisplays.Primary:
      display = primary;
      break;
    case DefaultDisplays.Secondary:
      display = displays.find(item => item.id !== primary.id);
      break;
    default:
      if (typeof scr.display === 'number') {
        display = findById(displays, scr.display);
      }
      break;
  }
  const page = scr.test ? await getPage(scr.test) : undefined;
  if (win?.isDestroyed()) return;
  if (!display || !page || (!page.permanent && getLicenseState().status !== 'active')) {
    win?.hide();
    return;
  }

  const needReload = force || !win || !prev || !isEqualOptions(scr, prev) || loadErrors.has(win);
  const params = createSearchParams(scr);
  params.append('port', port.toString());
  const url = (page.permanent ? `${page.url}?${params}` : page.url)?.replaceAll(
    '${resources}',
    process.resourcesPath,
  );
  const windowBounds = {
    x: scr.left + display.bounds.x,
    y: scr.top + display.bounds.y,
    width: scr.width,
    height: scr.height,
  };
  const isNewWindow = !win;
  const testWindow =
    win ??
    createTestWindow(windowBounds.width, windowBounds.height, windowBounds.x, windowBounds.y);
  configureOutputWindowInteractivity(testWindow);
  registerScreen(testWindow, scr);
  const contents = testWindow.webContents;
  const unavailable = () => testWindow.isDestroyed() || contents.isDestroyed();
  const recordError = (message: string) => {
    if (unavailable()) return;
    loadErrors.set(testWindow, message);
    testWindow.hide();
    debug(`Loading error. url: ${contents.getURL()}, error: ${message}`);
  };
  if (isNewWindow) {
    let retryTimer: NodeJS.Timeout | undefined;
    contents.on('did-navigate', (event, navigationUrl, status, statusText) => {
      // HTTP error documents still resolve loadURL(), unlike transport failures.
      if (status >= 400) recordError(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    });
    contents.on(
      'did-fail-load',
      (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3 || unavailable()) return;
        recordError(errorDescription || `Ошибка загрузки (${errorCode})`);
        if (retryTimer) clearTimeout(retryTimer);
        const failedTest = findScreenParams(id)?.test;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void queueUpdate(id, async () => {
            if (unavailable() || !loadErrors.has(testWindow)) return;
            const current = await getScreen(id);
            if (!unavailable() && current && current.test === failedTest) {
              await updateTestImpl(current, true);
            }
          }).catch(error => debug(`Retry error: ${String(error)}`));
        }, 5000);
        retryTimer.unref();
      },
    );
    testWindow.once('closed', () => {
      if (retryTimer) clearTimeout(retryTimer);
    });
  }
  testWindow.setKiosk(false);
  testWindow.setAlwaysOnTop(true, 'screen-saver');
  testWindow.setPosition(windowBounds.x, windowBounds.y);
  testWindow.setSize(windowBounds.width, windowBounds.height);
  if (page.userAgent && !contents.userAgent.includes(page.userAgent)) {
    void machineId.then(mid => {
      if (unavailable()) return;
      contents.userAgent = `${contents.userAgent} ${page.userAgent} machineid/${mid}`;
    });
  }
  if (needReload && url) {
    testWindow.hide();
    loadErrors.delete(testWindow);
    try {
      await testWindow.loadURL(url);
      if (unavailable() || loadErrors.has(testWindow)) return;
      await contents.insertCSS(
        scr.outputTransparent ? `${hideCursorCSS}\n${transparentOutputCSS}` : hideCursorCSS,
      );
    } catch (error) {
      if (!isLoadAborted(error) && !loadErrors.has(testWindow)) {
        recordError(error instanceof Error ? error.message : String(error));
      }
      return;
    }
  }
  if (unavailable() || loadErrors.has(testWindow)) return;
  if (isScreenOutputHidden(scr.id)) testWindow.hide();
  else {
    testWindow.showInactive();
    arrangeOutputWindows();
  }
};

export const updateTest = (scr: Screen, force = false): Promise<void> =>
  queueUpdate(scr.id, () => updateTestImpl(scr, force));
