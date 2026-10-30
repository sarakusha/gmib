import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Screen } from '/@common/video';

const mock = vi.hoisted(() => ({
  windows: new Map<number, any>(),
  params: new Map<number, any>(),
  hidden: false,
  createWindow: vi.fn(),
  arrange: vi.fn(),
  getScreen: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: { fromId: (id: number) => mock.windows.get(id) },
  screen: {
    getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0 } }),
    getAllDisplays: () => [{ id: 1, bounds: { x: 0, y: 0 } }],
  },
}));
vi.mock('../src/config', () => ({ port: 9001 }));
vi.mock('../src/machineId', () => ({ default: Promise.resolve('machine') }));
vi.mock('../src/licenseState', () => ({ getLicenseState: () => ({ status: 'active' }) }));
vi.mock('../src/mainWindow', () => ({ createTestWindow: mock.createWindow }));
vi.mock('../src/openHandler', () => ({
  arrangeOutputWindows: mock.arrange,
  configureOutputWindowInteractivity: vi.fn(),
}));
vi.mock('../src/page', () => ({
  getPage: async () => ({ permanent: true, url: 'http://localhost/plugins/informer/screen.html' }),
}));
vi.mock('../src/screen', () => ({ getScreen: mock.getScreen }));
vi.mock('../src/outputVisibility', () => ({ isScreenOutputHidden: () => mock.hidden }));
vi.mock('../src/windowStore', () => ({
  createSearchParams: () => new URLSearchParams(),
  findScreenParams: (id: number) => mock.params.get(id),
  isEqualOptions: (scr: Screen, prev: Screen) => scr.test === prev.test,
  registerScreen: (window: { id: number }, scr: Screen) => {
    mock.params.set(scr.id, { ...scr, id: window.id });
  },
}));

import { getScreenOutputError, updateTest } from '../src/screenOutput';

const scr: Screen = {
  id: 9,
  name: 'Wide',
  display: 1,
  left: 0,
  top: 0,
  width: 800,
  height: 400,
  test: 'plugin:informer:wide',
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const createWindow = () => {
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getURL: () => 'http://localhost/plugins/informer/screen.html',
    userAgent: 'test',
    insertCSS: vi.fn(async () => 'css-key'),
  });
  const window = Object.assign(new EventEmitter(), {
    id: 7,
    visible: false,
    destroyed: false,
    isDestroyed: () => window.destroyed,
    hide: vi.fn(() => {
      window.visible = false;
    }),
    showInactive: vi.fn(() => {
      window.visible = true;
    }),
    close: vi.fn(),
    setKiosk: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    webContents: contents,
    loadURL: vi.fn(async () => {
      contents.emit('did-navigate', {}, contents.getURL(), 200, 'OK');
    }),
  });
  mock.windows.set(window.id, window);
  return window;
};
let window: ReturnType<typeof createWindow>;

beforeEach(() => {
  vi.clearAllMocks();
  mock.windows.clear();
  mock.params.clear();
  mock.hidden = false;
  mock.getScreen.mockResolvedValue(scr);
  window = createWindow();
  mock.createWindow.mockReturnValue(window);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('screen output loading', () => {
  it('hides an HTTP error page and reloads it on the next show with identical options', async () => {
    window.loadURL.mockImplementationOnce(async () => {
      window.webContents.emit('did-navigate', {}, window.webContents.getURL(), 404, 'Not Found');
    });
    await updateTest(scr);
    expect(getScreenOutputError(scr.id)).toContain('404');
    expect(window.visible).toBe(false);
    expect(window.showInactive).not.toHaveBeenCalled();

    await updateTest(scr);
    expect(mock.createWindow).toHaveBeenCalledOnce();
    expect(window.loadURL).toHaveBeenCalledTimes(2);
    expect(getScreenOutputError(scr.id)).toBeUndefined();
    expect(window.visible).toBe(true);
  });

  it('waits for both navigation and CSS before showing or resolving', async () => {
    const navigation = deferred();
    const css = deferred();
    window.loadURL.mockReturnValueOnce(navigation.promise);
    window.webContents.insertCSS.mockImplementationOnce(async () => {
      await css.promise;
      return 'css-key';
    });
    const done = vi.fn();
    const update = updateTest(scr).then(done);
    await vi.waitFor(() => expect(window.loadURL).toHaveBeenCalledOnce());
    expect(done).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();
    navigation.resolve();
    await vi.waitFor(() => expect(window.webContents.insertCSS).toHaveBeenCalledOnce());
    expect(done).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();
    css.resolve();
    await update;
    expect(window.visible).toBe(true);
    expect(mock.arrange).toHaveBeenCalledOnce();
  });

  it('preserves hide intent changed while navigation is pending', async () => {
    const navigation = deferred();
    window.loadURL.mockReturnValueOnce(navigation.promise);
    const update = updateTest(scr);
    await vi.waitFor(() => expect(window.loadURL).toHaveBeenCalledOnce());
    mock.hidden = true;
    navigation.resolve();
    await update;
    expect(window.visible).toBe(false);
    expect(window.showInactive).not.toHaveBeenCalled();
  });

  it('records a rejected main frame load and hides a previously visible window', async () => {
    vi.useFakeTimers();
    await updateTest(scr);
    window.loadURL.mockImplementationOnce(async () => {
      window.webContents.emit(
        'did-fail-load',
        {},
        -102,
        'ERR_CONNECTION_REFUSED',
        window.webContents.getURL(),
        true,
      );
      throw new Error('ERR_CONNECTION_REFUSED');
    });
    await updateTest(scr, true);
    expect(getScreenOutputError(scr.id)).toContain('ERR_CONNECTION_REFUSED');
    expect(window.visible).toBe(false);
    expect(window.showInactive).toHaveBeenCalledOnce();
  });

  it('ignores subframe failures and aborted navigations', async () => {
    await updateTest(scr);
    window.webContents.emit(
      'did-fail-load',
      {},
      -102,
      'ERR_CONNECTION_REFUSED',
      'http://frame',
      false,
    );
    window.webContents.emit(
      'did-fail-load',
      {},
      -3,
      'ERR_ABORTED',
      window.webContents.getURL(),
      true,
    );
    expect(getScreenOutputError(scr.id)).toBeUndefined();
    expect(window.visible).toBe(true);
  });

  it('does not show or access CSS after the window is destroyed during navigation', async () => {
    const navigation = deferred();
    window.loadURL.mockReturnValueOnce(navigation.promise);
    const update = updateTest(scr);
    await vi.waitFor(() => expect(window.loadURL).toHaveBeenCalledOnce());
    window.destroyed = true;
    navigation.resolve();
    await update;
    expect(window.webContents.insertCSS).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();
  });

  it('does not revive a stopped screen when the network retry fires', async () => {
    vi.useFakeTimers();
    window.loadURL.mockImplementationOnce(async () => {
      window.webContents.emit(
        'did-fail-load',
        {},
        -102,
        'ERR_CONNECTION_REFUSED',
        window.webContents.getURL(),
        true,
      );
      throw new Error('ERR_CONNECTION_REFUSED');
    });
    await updateTest(scr);
    mock.getScreen.mockResolvedValue({ ...scr, test: undefined });
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.getScreen).toHaveBeenCalledWith(scr.id);
    expect(window.loadURL).toHaveBeenCalledOnce();
    expect(window.visible).toBe(false);
  });

  it('retries a network failure through the normal load and visibility flow', async () => {
    vi.useFakeTimers();
    window.loadURL.mockImplementationOnce(async () => {
      window.webContents.emit(
        'did-fail-load',
        {},
        -102,
        'ERR_CONNECTION_REFUSED',
        window.webContents.getURL(),
        true,
      );
      throw new Error('ERR_CONNECTION_REFUSED');
    });
    await updateTest(scr);
    mock.hidden = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(window.loadURL).toHaveBeenCalledTimes(2);
    expect(getScreenOutputError(scr.id)).toBeUndefined();
    expect(window.webContents.insertCSS).toHaveBeenCalledOnce();
    expect(window.visible).toBe(false);
  });

  it('keeps queued updates serialized through navigation and CSS completion', async () => {
    const navigation = deferred();
    window.loadURL.mockReturnValueOnce(navigation.promise);
    const first = updateTest(scr);
    const second = updateTest(scr, true);
    await vi.waitFor(() => expect(window.loadURL).toHaveBeenCalledOnce());
    navigation.resolve();
    await Promise.all([first, second]);
    expect(window.loadURL).toHaveBeenCalledTimes(2);
    expect(window.webContents.insertCSS).toHaveBeenCalledTimes(2);
    expect(window.loadURL.mock.invocationCallOrder[1]).toBeGreaterThan(
      window.webContents.insertCSS.mock.invocationCallOrder[0],
    );
  });
});
