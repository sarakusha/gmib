import type { BrowserWindowConstructorOptions, Event, Input, WebPreferences } from 'electron';
import { app, BrowserWindow, dialog, WebContentsView } from 'electron';
import { EventEmitter } from 'events';

import { createCloseEvent } from './managedWindow';
import localConfig from './localConfig';

import type { ManagedWindow } from './managedWindow';

const TAB_HEIGHT = 36;
let forceClose = false;
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach(listener => listener());
};

app.once('before-quit', () => {
  forceClose = true;
});

type Tab = {
  id: number;
  title: string;
  view: WebContentsView;
  window: TabWindow;
  hidden: boolean;
  destroyed: boolean;
};

export type TabbedWindowItem = {
  id: number;
  title: string;
};

class TabWindow extends EventEmitter implements ManagedWindow {
  readonly id: number;

  constructor(private readonly manager: TabbedWindow, private readonly tab: Omit<Tab, 'window'>) {
    super();
    this.id = tab.id;
  }

  get webContents() {
    return this.tab.view.webContents;
  }

  close() {
    this.manager.closeTab(this.tab.id);
  }

  focus() {
    this.manager.activate(this.tab.id);
    this.webContents.focus();
  }

  hide() {
    this.manager.hide(this.tab.id);
  }

  isDestroyed() {
    return this.tab.destroyed || this.webContents.isDestroyed();
  }

  isVisible() {
    return !this.tab.hidden && this.manager.isVisible(this.tab.id);
  }

  loadURL(url: string) {
    return this.webContents.loadURL(url);
  }

  setTitle(title: string) {
    this.manager.setTitle(this.tab.id, title);
  }

  show() {
    this.manager.show(this.tab.id);
  }
}

class TabbedWindow {
  readonly window: BrowserWindow;

  private readonly chrome: WebContentsView;

  private tabs: Tab[] = [];

  private activeId: number | undefined;

  constructor() {
    const options: BrowserWindowConstructorOptions = {
      show: false,
      backgroundColor: '#fff',
      useContentSize: true,
      width: 1040,
      height: 720,
      title: import.meta.env.VITE_APP_NAME,
      webPreferences: {
        backgroundThrottling: false,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    };
    this.window = new BrowserWindow(options);
    this.chrome = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });
    this.window.contentView.addChildView(this.chrome);
    this.window.on('resize', () => this.layout());
    this.window.on('close', event => {
      if (forceClose) return;
      event.preventDefault();
      void this.closeApplication();
    });
    this.window.on('closed', () => {
      for (const tab of this.tabs) {
        tab.window.emit('closed');
      }
      this.tabs = [];
    });
    this.window.on('show', () => {
      this.window.focus();
      this.activeTab()?.window.webContents.focus();
    });
    this.chrome.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      this.handleChromeUrl(url);
    });
    this.installKeyboardShortcuts(this.chrome);
    void this.chrome.webContents.loadURL(this.chromeUrl()).then(() => this.render());
    this.layout();
  }

  createTab(title: string, webPreferences: WebPreferences): ManagedWindow {
    const view = new WebContentsView({ webPreferences });
    const tab = {
      id: view.webContents.id,
      title,
      view,
      hidden: false,
      destroyed: false,
    } as Omit<Tab, 'window'>;
    const window = new TabWindow(this, tab);
    const fullTab = Object.assign(tab, { window });
    this.tabs.push(fullTab);
    this.window.contentView.addChildView(view);
    this.installKeyboardShortcuts(view);
    view.webContents.once('did-finish-load', () => {
      window.emit('ready-to-show');
    });
    view.webContents.on('page-title-updated', event => {
      event.preventDefault();
    });
    if (!this.activeId) this.activeId = tab.id;
    this.render();
    this.layout();
    emitChange();
    return window;
  }

  activate(id: number) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab || tab.destroyed) return;
    const prev = this.activeTab();
    if (prev && prev.id !== id) prev.window.webContents.send('focus', false);
    tab.hidden = false;
    this.activeId = id;
    this.window.contentView.addChildView(tab.view);
    this.window.show();
    this.window.focus();
    tab.view.webContents.focus();
    tab.window.webContents.send('focus', true);
    this.render();
    this.layout();
    emitChange();
  }

  closeTab(id: number) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab || tab.destroyed) return;
    const event = createCloseEvent();
    tab.window.emit('close', event);
    if (event.defaultPrevented) return;
    this.window.contentView.removeChildView(tab.view);
    tab.destroyed = true;
    tab.view.webContents.close();
    this.tabs = this.tabs.filter(item => item.id !== id);
    tab.window.emit('closed');
    if (this.activeId === id) this.activeId = this.tabs.find(item => !item.hidden)?.id;
    if (this.activeId) this.activate(this.activeId);
    else {
      this.render();
      this.window.close();
    }
    emitChange();
  }

  hide(id: number) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab) return;
    tab.hidden = true;
    tab.view.setVisible(false);
    if (this.activeId === id) {
      this.activeId = this.tabs.find(item => !item.hidden && item.id !== id)?.id;
      if (this.activeId) this.activate(this.activeId);
    }
    this.render();
    emitChange();
  }

  isVisible(id: number) {
    return this.window.isVisible() && this.activeId === id;
  }

  setTitle(id: number, title: string) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab) return;
    tab.title = title;
    if (this.activeId === id) this.window.setTitle(title);
    this.render();
    emitChange();
  }

  show(id: number) {
    this.activate(id);
  }

  activateNext() {
    this.activateByOffset(1);
  }

  activatePrevious() {
    this.activateByOffset(-1);
  }

  getActiveWindow(): ManagedWindow | undefined {
    return this.activeTab()?.window;
  }

  getWindowById(id: number): ManagedWindow | undefined {
    return this.tabs.find(item => item.id === id)?.window;
  }

  getTitleById(id: number): string | undefined {
    return this.tabs.find(item => item.id === id)?.title;
  }

  getItems(): TabbedWindowItem[] {
    return this.visibleTabs().map(({ id, title }) => ({ id, title }));
  }

  private activateByOffset(offset: number) {
    const visibleTabs = this.visibleTabs();
    if (visibleTabs.length === 0) return;
    const activeIndex = visibleTabs.findIndex(tab => tab.id === this.activeId);
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const index = (currentIndex + offset + visibleTabs.length) % visibleTabs.length;
    this.activate(visibleTabs[index].id);
  }

  private activateByPosition(position: number) {
    const tab = this.visibleTabs()[position];
    if (tab) this.activate(tab.id);
  }

  private activeTab() {
    return this.tabs.find(item => item.id === this.activeId);
  }

  private async closeApplication() {
    if (localConfig.get('autostart')) {
      this.window.hide();
      return;
    }
    if (this.visibleTabs().length > 1) {
      const { response } = await dialog.showMessageBox(this.window, {
        type: 'question',
        title: 'Закрыть приложение',
        message: 'Закрыть все вкладки и выйти из приложения?',
        buttons: ['Закрыть', 'Отмена'],
        defaultId: 1,
        cancelId: 1,
      });
      if (response !== 0) return;
    }
    app.quit();
  }


  private visibleTabs() {
    return this.tabs.filter(tab => !tab.hidden && !tab.destroyed);
  }

  private layout() {
    const [width, height] = this.window.getContentSize();
    this.chrome.setBounds({ x: 0, y: 0, width, height: TAB_HEIGHT });
    this.tabs.forEach(tab => {
      const active = tab.id === this.activeId && !tab.hidden;
      tab.view.setVisible(active);
      tab.view.setBounds({ x: 0, y: TAB_HEIGHT, width, height: Math.max(0, height - TAB_HEIGHT) });
    });
  }

  private render() {
    const active = this.activeTab();
    if (active) this.window.setTitle(active.title);
    const tabs = this.tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      active: tab.id === this.activeId,
      hidden: tab.hidden,
    }));
    const script = `window.renderTabs(${JSON.stringify(tabs)})`;
    this.chrome.webContents.executeJavaScript(script).catch(() => undefined);
  }

  private handleChromeUrl(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'gmib-tab:') return;
      const id = Number(parsed.searchParams.get('id'));
      if (!Number.isInteger(id)) return;
      if (parsed.hostname === 'activate') this.activate(id);
      if (parsed.hostname === 'close') this.closeTab(id);
    } catch {
      // Ignore malformed chrome navigation.
    }
  }

  private handleKeyboardShortcut(event: Event, input: Input) {
    if (input.type !== 'keyDown') return;
    const commandOrControl = input.meta || input.control;
    if (!commandOrControl || input.alt) return;
    const key = input.key.toLowerCase();
    const code = input.code.toLowerCase();
    const digit = key.match(/^\d$/)?.[0] ?? code.match(/^digit(\d)$/)?.[1];
    if (digit) {
      event.preventDefault();
      this.activateByPosition(digit === '0' ? 9 : Number(digit) - 1);
      return;
    }
    if (key === 'tab') {
      event.preventDefault();
      this.activateByOffset(input.shift ? -1 : 1);
      return;
    }
    if (key === 'pageup') {
      event.preventDefault();
      this.activateByOffset(-1);
      return;
    }
    if (key === 'pagedown') {
      event.preventDefault();
      this.activateByOffset(1);
      return;
    }
    if (input.shift && (key === '[' || code === 'bracketleft')) {
      event.preventDefault();
      this.activateByOffset(-1);
      return;
    }
    if (input.shift && (key === ']' || code === 'bracketright')) {
      event.preventDefault();
      this.activateByOffset(1);
    }
  }

  private installKeyboardShortcuts(view: WebContentsView) {
    view.webContents.on('before-input-event', (event, input) => {
      this.handleKeyboardShortcut(event, input);
    });
  }

  private chromeUrl() {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: ${TAB_HEIGHT}px;
        overflow: hidden;
        background: #eceff1;
        color: #1f2933;
        font: 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
      }
      #tabs {
        height: ${TAB_HEIGHT}px;
        display: flex;
        align-items: end;
        gap: 2px;
        padding: 4px 8px 0;
        border-bottom: 1px solid #b8c2cc;
      }
      .tab {
        min-width: 120px;
        max-width: 240px;
        height: 31px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #b8c2cc;
        border-bottom: 0;
        border-radius: 7px 7px 0 0;
        padding: 0 7px 0 10px;
        background: #d9e2ec;
      }
      .tab.active { background: #fff; }
      .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .close {
        width: 18px;
        height: 18px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #52606d;
        line-height: 18px;
        padding: 0;
      }
      .close:hover { background: #cbd2d9; color: #102a43; }
    </style>
  </head>
  <body>
    <div id="tabs"></div>
    <script>
      const tabsNode = document.getElementById('tabs');
      window.renderTabs = tabs => {
        tabsNode.textContent = '';
        tabs.filter(tab => !tab.hidden).forEach(tab => {
          const item = document.createElement('div');
          item.className = 'tab' + (tab.active ? ' active' : '');
          item.title = tab.title;
          item.addEventListener('click', () => {
            window.location.href = 'gmib-tab://activate?id=' + tab.id;
          });
          const title = document.createElement('span');
          title.className = 'title';
          title.textContent = tab.title;
          const close = document.createElement('button');
          close.className = 'close';
          close.type = 'button';
          close.title = 'Закрыть';
          close.textContent = '×';
          close.addEventListener('click', event => {
            event.stopPropagation();
            window.location.href = 'gmib-tab://close?id=' + tab.id;
          });
          item.append(title, close);
          tabsNode.append(item);
        });
      };
      window.renderTabs([]);
    </script>
  </body>
</html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
}

let manager: TabbedWindow | undefined;

const getManager = () => {
  manager ??= new TabbedWindow();
  return manager;
};

export const createTabbedWindow = (
  title: string,
  preload: string,
): ManagedWindow => {
  const webPreferences: WebPreferences = {
    webviewTag: false,
    preload,
    backgroundThrottling: false,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
  };
  return getManager().createTab(title, webPreferences);
};

export const getTabbedBrowserWindow = (): BrowserWindow | undefined => manager?.window;

export const getActiveTabbedWindow = (): ManagedWindow | undefined => manager?.getActiveWindow();

export const activateNextTabbedWindow = (): void => manager?.activateNext();

export const activatePreviousTabbedWindow = (): void => manager?.activatePrevious();

export const activateTabbedWindow = (id: number): void => manager?.activate(id);

export const getTabbedWindowById = (id: number): ManagedWindow | undefined =>
  manager?.getWindowById(id);

export const getTabbedWindowTitle = (id: number): string | undefined => manager?.getTitleById(id);

export const getTabbedWindowItems = (): TabbedWindowItem[] => manager?.getItems() ?? [];

export const isTabbedBrowserWindow = (window: BrowserWindow | undefined | null): boolean =>
  !!window && window === manager?.window;

export const onTabbedWindowChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
