import type { Display } from 'electron';
import { BrowserWindow, screen } from 'electron';

import debugFactory from 'debug';

import type { Screen } from '/@common/video';
import { DefaultDisplays } from '/@common/video';
import { findById } from '/@common/helpers';

import { port } from './config';
import machineId from './machineId';
import { createTestWindow } from './mainWindow';
import {
  arrangeOutputWindows,
  configureOutputWindowInteractivity,
  isOutputWindowsHidden,
} from './openHandler';
import { getPage } from './page';
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

export const updateTest = async (scr: Screen, force = false): Promise<void> => {
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
  if (!display || !page) {
    win?.hide();
    return;
  }

  const needReload = force || !win || !prev || !isEqualOptions(scr, prev);
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
  const testWindow =
    win ??
    createTestWindow(windowBounds.width, windowBounds.height, windowBounds.x, windowBounds.y);
  configureOutputWindowInteractivity(testWindow);
  registerScreen(testWindow, scr);
  const contents = testWindow.webContents;
  contents.on('did-fail-load', (event, errorCode, errorDescription) => {
    debug(
      `Loading error. url: ${url}, errorCode: ${errorCode}, errorDescription: ${errorDescription}`,
    );
    setTimeout(() => contents.reload(), 5000).unref();
  });
  testWindow.setKiosk(false);
  testWindow.setAlwaysOnTop(true, 'screen-saver');
  testWindow.setPosition(windowBounds.x, windowBounds.y);
  testWindow.setSize(windowBounds.width, windowBounds.height);
  if (page.userAgent && !contents.userAgent.includes(page.userAgent)) {
    void machineId.then(mid => {
      contents.userAgent = `${contents.userAgent} ${page.userAgent} machineid/${mid}`;
    });
  }
  if (needReload && url) {
    void testWindow
      .loadURL(url)
      .then(() =>
        testWindow.webContents.insertCSS(
          scr.outputTransparent ? `${hideCursorCSS}\n${transparentOutputCSS}` : hideCursorCSS,
        ),
      );
  }
  if (isOutputWindowsHidden()) testWindow.hide();
  else {
    testWindow.show();
    arrangeOutputWindows();
  }
};
