import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  params: vi.fn(),
  localList: vi.fn(),
  localCatalog: vi.fn(),
  localEnable: vi.fn(),
  localInstall: vi.fn(),
  localOfficial: vi.fn(),
  localUninstall: vi.fn(),
  localOpen: vi.fn(),
  localRestart: vi.fn(),
  remoteList: vi.fn(),
  remoteCatalog: vi.fn(),
  remoteEnable: vi.fn(),
  remoteInstall: vi.fn(),
  remoteOfficial: vi.fn(),
  remoteUninstall: vi.fn(),
  remoteOpen: vi.fn(),
  remoteRestart: vi.fn(),
  factory: vi.fn(),
  support: vi.fn(),
  capability: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { whenReady: () => Promise.resolve() },
  ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => mock.handlers.set(name, fn) },
}));
vi.mock('../src/windowStore', () => ({ findParamsByWebContentsId: mock.params }));
vi.mock('../src/pluginHost', () => ({ openPluginControl: mock.localOpen }));
vi.mock('../src/pluginLifecycle', () => ({
  pluginLifecycle: {
    list: mock.localList,
    catalog: mock.localCatalog,
    setEnabled: mock.localEnable,
  },
}));
vi.mock('../src/pluginLifecycleUi', () => ({
  installPluginFromDialog: mock.localInstall,
  installOfficialPluginFromDialog: mock.localOfficial,
  uninstallPluginFromDialog: mock.localUninstall,
}));
vi.mock('../src/relaunch', () => ({ default: mock.localRestart }));
vi.mock('../src/licenseState', () => ({ requireLicenseCapability: mock.capability }));
vi.mock('../src/remotePluginLifecycle', () => ({
  createRemotePluginLifecycle: mock.factory,
  requireRemotePluginSupport: mock.support,
}));
vi.mock('../src/remotePluginControl', () => ({ openRemotePluginControl: mock.remoteOpen }));

import '../src/pluginsIpc';
const sender = { id: 42 };
const event = { sender };
const params = { type: 'gmib', host: 'selected-host', nibusPort: 9010, info: { version: '5.7.1' } };
const invoke = (name: string, ...args: unknown[]) =>
  mock.handlers.get(`plugins:${name}`)!(event, ...args);

beforeEach(() => {
  vi.clearAllMocks();
  mock.params.mockReturnValue(params);
  mock.factory.mockReturnValue({
    list: mock.remoteList,
    catalog: mock.remoteCatalog,
    install: mock.remoteInstall,
    installOfficial: mock.remoteOfficial,
    setEnabled: mock.remoteEnable,
    uninstall: mock.remoteUninstall,
    restart: mock.remoteRestart,
  });
});

describe('plugin IPC connection ownership', () => {
  it('routes all remote operations to the registered sender connection', async () => {
    await invoke('list');
    await invoke('catalog');
    await invoke('install');
    await invoke('installOfficial', 'sample');
    await invoke('setEnabled', 'sample', true);
    await invoke('uninstall', 'sample');
    await invoke('openControl', 'sample');
    await invoke('restart');
    expect(mock.params).toHaveBeenCalledWith(42);
    expect(mock.factory).toHaveBeenCalledWith(params);
    expect(mock.remoteOpen).toHaveBeenCalledWith(params, 'sample', sender);
    for (const fn of [
      mock.remoteList,
      mock.remoteCatalog,
      mock.remoteInstall,
      mock.remoteOfficial,
      mock.remoteEnable,
      mock.remoteUninstall,
      mock.remoteRestart,
    ])
      expect(fn).toHaveBeenCalledTimes(1);
    for (const fn of [
      mock.localList,
      mock.localCatalog,
      mock.localInstall,
      mock.localOfficial,
      mock.localEnable,
      mock.localUninstall,
      mock.localOpen,
      mock.localRestart,
      mock.capability,
    ])
      expect(fn).not.toHaveBeenCalled();
  });

  it('rejects unknown and player senders without falling back to local mutations', () => {
    for (const value of [undefined, { type: 'player', host: 'selected-host' }]) {
      mock.params.mockReturnValue(value);
      for (const name of [
        'list',
        'catalog',
        'install',
        'installOfficial',
        'setEnabled',
        'uninstall',
        'openControl',
        'restart',
      ])
        expect(() => invoke(name, 'sample', true)).toThrow('подключения GMIB');
    }
    expect(mock.factory).not.toHaveBeenCalled();
    expect(mock.localRestart).not.toHaveBeenCalled();
    expect(mock.localEnable).not.toHaveBeenCalled();
  });

  it('fails closed on unsupported remote hosts', () => {
    mock.support.mockImplementationOnce(() => {
      throw new Error('Update remote');
    });
    expect(() => invoke('restart')).toThrow('Update remote');
    expect(mock.factory).not.toHaveBeenCalled();
    expect(mock.localRestart).not.toHaveBeenCalled();
  });

  it('keeps registered local sessions on the existing local lifecycle', async () => {
    mock.params.mockReturnValue({ ...params, host: 'localhost' });
    mock.localEnable.mockResolvedValue({ plugin: { id: 'sample' } });
    await invoke('list');
    await invoke('install');
    await invoke('setEnabled', 'sample', true);
    await invoke('restart');
    expect(mock.localList).toHaveBeenCalledTimes(1);
    expect(mock.localInstall).toHaveBeenCalledTimes(1);
    expect(mock.localEnable).toHaveBeenCalledWith('sample', true);
    expect(mock.localRestart).toHaveBeenCalledTimes(1);
    expect(mock.factory).not.toHaveBeenCalled();
  });
});
