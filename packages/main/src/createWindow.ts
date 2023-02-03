import { app, BrowserWindow, screen } from 'electron';

// import debugFactory from 'debug';

import windows from './windows';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:createWindow`);

const createWindow = (title: string, preload: string, random = true): BrowserWindow => {
  // debug({ preload, vite: import.meta.env.VITE_PLAYER });
  const size = {
    width: 840,
    height: 620,
  };
  const browserWindow = new BrowserWindow({
    show: false, // Use 'ready-to-show' event to show window
    skipTaskbar: true,
    backgroundColor: '#fff',
    useContentSize: true,
    // ...pos,
    ...size,
    title,
    webPreferences: {
      // nativeWindowOpen: true,
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like iframe or Electron's BrowserView. https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload,
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      // nodeIntegrationInWorker: true,
    },
  });

  random &&
    app.whenReady().then(() => {
      const display = screen.getPrimaryDisplay().workAreaSize;
      const x = Math.round(Math.random() * Math.max(0, display.width - size.width));
      const y = Math.round(Math.random() * Math.max(0, display.height - size.height));
      browserWindow.setPosition(x, y);
    });

  windows.add(browserWindow);
  browserWindow.on('closed', () => {
    windows.delete(browserWindow);
  });

  browserWindow.on('show', () => {
    browserWindow.setSkipTaskbar(false);
    browserWindow.focus();
    return false;
  });
  browserWindow.on('hide', () => {
    browserWindow.setSkipTaskbar(true);
    return false;
  });
  browserWindow.on('minimize', (event: Event) => {
    event.preventDefault();
    browserWindow.hide();
    return false;
  });

  return browserWindow;
};

export default createWindow;
