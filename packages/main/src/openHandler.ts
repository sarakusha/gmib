import type { BrowserWindowConstructorOptions, WebContents } from 'electron';

import type { Display as DisplayType } from '@nibus/core';
import debugFactory from 'debug';
import find from 'lodash/find';

import { DefaultDisplays } from '../../common/video';

import getAllDisplays from './getAllDisplays';


type Handler = Parameters<WebContents['setWindowOpenHandler']>[0];

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:window`);

const toNumber = <T extends number | undefined>(
  value: string | null,
  defaultValue?: T,
): number | T => {
  const result = value == null ? defaultValue : +value;
  return (Number.isNaN(result) ? defaultValue : result) as T;
};

const openHandler: Handler = ({ url }) => {
  const { searchParams } = new URL(url);
  // if (pathname !== '/output/index.html') return { action: 'deny' };
  const displays = getAllDisplays();
  debug(`OPEN-HANDLER: ${JSON.stringify({ url, displays })}`);
  // console.log({ displays });
  const displayParam = searchParams.get('display');
  const displayId = toNumber(displayParam);
  const x = toNumber(searchParams.get('left'), 0);
  const y = toNumber(searchParams.get('top'), 0);
  const width = toNumber(searchParams.get('width'));
  const height = toNumber(searchParams.get('height'));
  const kiosk = !!toNumber(searchParams.get('kiosk'), 0);
  const transparent = !!toNumber(searchParams.get('transparent'), 0);
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
  const overrideBrowserWindowOptions: BrowserWindowConstructorOptions = {
    x: x + display.bounds.x,
    y: y + display.bounds.y,
    width,
    height,
    frame: kiosk,
    backgroundColor: transparent ? undefined : '#000',
    focusable: false,
    // fullscreen: kiosk,
    // simpleFullscreen: true,
    kiosk,
    transparent,
    // show: false,
    alwaysOnTop: true,
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
