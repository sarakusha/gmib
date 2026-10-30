import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  nextId: 0,
  nextNativeId: 0,
  quit: vi.fn(),
  windowFocus: vi.fn(),
  windowClose: vi.fn(),
}));
vi.mock('../src/localConfig', () => ({ default: { get: () => false } }));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class WebContents extends EventEmitter {
    id = ++mocks.nextId;
    destroyed = false;
    focus = vi.fn();
    loadURL = vi.fn().mockResolvedValue(undefined);
    executeJavaScript = vi.fn().mockResolvedValue(undefined);
    close = vi.fn(() => {
      this.destroyed = true;
    });
    isDestroyed = () => this.destroyed;
  }
  class WebContentsView {
    webContents = new WebContents();
    setVisible = vi.fn();
    setBounds = vi.fn();
  }
  class BrowserWindow extends EventEmitter {
    id = ++mocks.nextNativeId;
    contentView = { addChildView: vi.fn(), removeChildView: vi.fn() };
    visible = false;
    focus = mocks.windowFocus;
    setTitle = vi.fn();
    getContentSize = () => [1040, 720];
    isVisible = () => this.visible;
    show() {
      this.visible = true;
    }
    hide() {
      this.visible = false;
    }
    close = mocks.windowClose;
  }
  return {
    app: { once: vi.fn(), quit: mocks.quit },
    BrowserWindow,
    WebContentsView,
    dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 1 }) },
  };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.nextId = 0;
  mocks.nextNativeId = 0;
});

const create = async () => {
  const api = await import('../src/tabbedWindow');
  const a = api.createTabbedWindow('A', '/test/preload');
  const b = api.createTabbedWindow('B', '/test/preload');
  const c = api.createTabbedWindow('C', '/test/preload');
  return { ...api, a, b, c };
};

describe('window tab selection history', () => {
  it('returns through the previous selected tabs instead of the first tab', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    b.show();
    c.show();
    c.close();
    expect(getActiveTabbedWindow()).toBe(b);
    b.close();
    expect(getActiveTabbedWindow()).toBe(a);
  });

  it('uses visit order after repeated switches, independently of tab strip order', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    c.show();
    b.show();
    c.show();
    b.show();
    b.close();
    expect(getActiveTabbedWindow()).toBe(c);
    c.close();
    expect(getActiveTabbedWindow()).toBe(a);
  });

  it('keeps C selected when background B closes and then returns from C to A', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    b.show();
    c.show();
    vi.mocked(c.webContents.focus).mockClear();
    mocks.windowFocus.mockClear();
    b.close();
    expect(getActiveTabbedWindow()).toBe(c);
    expect(c.webContents.focus).not.toHaveBeenCalled();
    expect(mocks.windowFocus).not.toHaveBeenCalled();
    c.close();
    expect(getActiveTabbedWindow()).toBe(a);
  });

  it('uses the same history when a close handler keeps a player alive by hiding its tab', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    c.show();
    b.show();
    b.on('close', event => {
      event.preventDefault();
      b.hide();
    });
    b.close();
    expect(b.isDestroyed()).toBe(false);
    expect(getActiveTabbedWindow()).toBe(c);
    c.close();
    expect(getActiveTabbedWindow()).toBe(a);
    b.show();
    expect(getActiveTabbedWindow()).toBe(b);
    b.close();
    expect(getActiveTabbedWindow()).toBe(a);
  });

  it('skips hidden background tabs without changing the active tab', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    b.show();
    c.show();
    b.hide();
    expect(getActiveTabbedWindow()).toBe(c);
    c.close();
    expect(getActiveTabbedWindow()).toBe(a);
  });

  it('keeps selection and history intact when closing is cancelled', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    a.show();
    b.show();
    c.show();
    const cancel = (event: { preventDefault: () => void }) => event.preventDefault();
    c.on('close', cancel);
    c.close();
    expect(getActiveTabbedWindow()).toBe(c);
    expect(c.isDestroyed()).toBe(false);
    c.removeListener('close', cancel);
    c.close();
    expect(getActiveTabbedWindow()).toBe(b);
  });

  it('falls back to an unvisited open tab, and closes the window after the last tab', async () => {
    const { a, b, c, getActiveTabbedWindow } = await create();
    expect(getActiveTabbedWindow()).toBe(a);
    a.close();
    expect(getActiveTabbedWindow()).toBe(b);
    b.close();
    expect(getActiveTabbedWindow()).toBe(c);
    expect(mocks.windowClose).not.toHaveBeenCalled();
    c.close();
    expect(getActiveTabbedWindow()).toBeUndefined();
    expect(mocks.windowClose).toHaveBeenCalledOnce();
  });
});

describe('tab and native window identity', () => {
  it('keeps tab registry handles separate when native and WebContents IDs collide', async () => {
    const { a, b, getTabbedWindowById } = await create();
    const { BrowserWindow } = await import('electron');
    const nativeOutput = new BrowserWindow({});
    // Electron's two native counters are independent. A native output window
    // may have exactly the same numeric ID as a tab's renderer WebContents.
    expect(nativeOutput.id).toBe(a.webContents.id);
    expect(a.id).toBe(-a.webContents.id);
    expect(b.id).toBe(-b.webContents.id);
    expect(a.id).toBeLessThan(0);
    expect(a.webContents.id).toBeGreaterThan(0);
    const registry = new Map<number, unknown>();
    registry.set(a.id, a);
    registry.set(nativeOutput.id, nativeOutput);
    expect(registry.size).toBe(2);
    expect(registry.get(a.id)).toBe(a);
    expect(registry.get(nativeOutput.id)).toBe(nativeOutput);
    expect(getTabbedWindowById(a.id)).toBe(a);
    expect(getTabbedWindowById(nativeOutput.id)).toBeUndefined();
  });

  it('renders negative tab handles and navigates activate/close links using them', async () => {
    const { a, b, c, getTabbedBrowserWindow, getActiveTabbedWindow, getTabbedWindowItems } =
      await create();
    const window = getTabbedBrowserWindow()!;
    const chrome = vi.mocked(window.contentView.addChildView).mock.calls[0][0] as {
      webContents: {
        emit: (event: string, ...args: unknown[]) => boolean;
        executeJavaScript: ReturnType<typeof vi.fn>;
      };
    };
    const rendered = chrome.webContents.executeJavaScript.mock.calls.at(-1)![0] as string;
    expect(rendered).toContain(`"id":${a.id}`);
    expect(rendered).toContain(`"id":${b.id}`);
    expect(getTabbedWindowItems().map(item => item.id)).toEqual([a.id, b.id, c.id]);
    const event = { preventDefault: vi.fn() };
    chrome.webContents.emit('will-navigate', event, `gmib-tab://activate?id=${b.id}`);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(getActiveTabbedWindow()).toBe(b);
    chrome.webContents.emit('will-navigate', event, `gmib-tab://close?id=${b.id}`);
    expect(b.isDestroyed()).toBe(true);
    expect(getActiveTabbedWindow()).toBe(a);
    expect(getTabbedWindowItems().map(item => item.id)).toEqual([a.id, c.id]);
  });

  it('ignores native, missing and unsafe IDs in chrome navigation', async () => {
    const { a, getTabbedBrowserWindow, getActiveTabbedWindow } = await create();
    const window = getTabbedBrowserWindow()!;
    const chrome = vi.mocked(window.contentView.addChildView).mock.calls[0][0] as {
      webContents: { emit: (event: string, ...args: unknown[]) => boolean };
    };
    a.show();
    mocks.windowFocus.mockClear();
    for (const query of ['', '?id=0', '?id=2', '?id=-1.5', '?id=-9007199254740992']) {
      chrome.webContents.emit(
        'will-navigate',
        { preventDefault: vi.fn() },
        `gmib-tab://close${query}`,
      );
      chrome.webContents.emit(
        'will-navigate',
        { preventDefault: vi.fn() },
        `gmib-tab://activate${query}`,
      );
    }
    expect(a.isDestroyed()).toBe(false);
    expect(getActiveTabbedWindow()).toBe(a);
    expect(mocks.windowFocus).not.toHaveBeenCalled();
  });
});
