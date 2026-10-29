import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GmibApi } from '../gmib';
import type { PlayerApi } from '../player';
import type { RemoteApi } from '../remote';

const mock = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  listeners: new Map<string, (event: unknown, payload: unknown) => void>(),
  once: new Map<string, (event: unknown, payload: unknown) => void>(),
  invoke: vi.fn(),
  send: vi.fn(),
  removeListener: vi.fn(),
  dispatch: vi.fn(),
  setDispatch: vi.fn(),
  setLogLevel: vi.fn(),
  nibusLogLevel: vi.fn(),
  seek: vi.fn(),
  updateSrcObject: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      if (mock.exposed.has(key)) throw new Error(`Duplicate bridge key: ${key}`);
      mock.exposed.set(key, value);
    },
  },
  ipcRenderer: {
    once: (channel: string, listener: (event: unknown, payload: unknown) => void) =>
      mock.once.set(channel, listener),
    on: (channel: string, listener: (event: unknown, payload: unknown) => void) =>
      mock.listeners.set(channel, listener),
    invoke: mock.invoke,
    send: mock.send,
    removeListener: mock.removeListener,
  },
}));
vi.mock('./identify', () => ({ getSecret: () => 'secret', initialized: Promise.resolve(true) }));
vi.mock('./initlog', () => ({
  default: { log: vi.fn(), error: vi.fn() },
  setLogLevel: mock.setLogLevel,
}));
vi.mock('./ipcDispatch', () => ({ default: mock.dispatch, setDispatch: mock.setDispatch }));
vi.mock('../gmib/config', () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('../gmib/dialogs', () => ({ saveJSON: vi.fn() }));
vi.mock('../gmib/nibus', () => ({ setLogLevel: mock.nibusLogLevel }));
vi.mock('../gmib/mediaSource', () => ({ play: vi.fn(), close: vi.fn() }));
vi.mock('../gmib/plugins', () => ({ list: vi.fn() }));
vi.mock('../gmib/hid', () => ({}));
vi.mock('../player/mediaStream', () => ({
  seek: mock.seek,
  updateSrcObject: mock.updateSrcObject,
}));
vi.mock('../player/videoOuts', () => ({}));
vi.mock('/@renderer/store/currentSlice', () => ({
  setOutputHidden: (hidden: boolean) => ({ type: 'outputHidden', payload: hidden }),
}));
vi.mock('/@player/store/currentSlice', () => ({
  setOutputHidden: (hidden: boolean) => ({ type: 'outputHidden', payload: hidden }),
}));
vi.mock('/@common/remote', () => ({ host: 'preview-host', port: 9001, sourceId: 7 }));

class PreviewSocket {
  static instances: PreviewSocket[] = [];
  close = vi.fn();

  constructor(public url: string) {
    PreviewSocket.instances.push(this);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mock.exposed.clear();
  mock.listeners.clear();
  mock.once.clear();
  mock.invoke.mockResolvedValue(false);
  PreviewSocket.instances.length = 0;
  vi.stubGlobal('window', {
    location: { search: '?source_id=7' },
    clearTimeout: vi.fn(),
  });
  vi.stubGlobal('document', {
    readyState: 'loading',
    addEventListener: vi.fn(),
    querySelector: vi.fn(),
  });
  vi.stubGlobal('WebSocket', PreviewSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preload entrypoint bridge contracts', () => {
  it('exposes the GMIB API and forwards license notifications with an unsubscribe function', async () => {
    await import('../gmib');
    expect([...mock.exposed.keys()].sort()).toEqual(
      [
        'versions',
        'server',
        'setDispatch',
        'nibus',
        'config',
        'dialogs',
        'log',
        'setLogLevel',
        'identify',
        'initializeNovastar',
        'getLicenseState',
        'getDeviceName',
        'onLicenseStateChange',
        'mediaSource',
        'plugins',
      ].sort(),
    );
    const api = Object.fromEntries(mock.exposed) as GmibApi;
    const licenseState = { status: 'active' };
    mock.once.get('gmib-params')?.({}, { licenseState, info: { name: 'Test device' } });
    await expect(api.getLicenseState()).resolves.toBe(licenseState);
    await expect(api.getDeviceName()).resolves.toBe('Test device');

    const listener = vi.fn();
    const unsubscribe = api.onLicenseStateChange(listener);
    const handler = mock.listeners.get('runtimeLicenseState');
    handler?.({ sender: 'must stay private' }, licenseState);
    expect(listener).toHaveBeenCalledExactlyOnceWith(licenseState);
    unsubscribe();
    expect(mock.removeListener).toHaveBeenCalledExactlyOnceWith('runtimeLicenseState', handler);

    api.setLogLevel('nibus');
    expect(mock.setLogLevel).toHaveBeenCalledExactlyOnceWith('nibus');
    expect(mock.nibusLogLevel).toHaveBeenCalledExactlyOnceWith('nibus');
  });

  it('exposes local playback controls and broadcasts with the selected source ID', async () => {
    await import('../player');
    expect([...mock.exposed.keys()].sort()).toEqual(
      ['mediaStream', 'log', 'setDispatch', 'identify', 'socket', 'onUpdatePlaylist'].sort(),
    );
    const api = Object.fromEntries(mock.exposed) as PlayerApi;
    expect(Object.keys(api.mediaStream).sort()).toEqual(['seek', 'updateSrcObject']);
    api.mediaStream.seek(12);
    expect(mock.seek).toHaveBeenCalledExactlyOnceWith(12);
    api.socket.broadcast('setPosition', 12, 90);
    expect(mock.send).toHaveBeenCalledExactlyOnceWith('broadcast', 'setPosition', [7, 12, 90]);

    const update = vi.fn();
    api.onUpdatePlaylist(update);
    mock.listeners.get('updatePlaylist')?.({}, undefined);
    expect(update).toHaveBeenCalledOnce();
    mock.listeners.get('outputVisibility')?.({}, true);
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'outputHidden', payload: true });
  });

  it('exposes remote preview controls and reconnects without exposing local playback APIs', async () => {
    await import('../remote');
    expect([...mock.exposed.keys()].sort()).toEqual(
      ['log', 'setDispatch', 'mediaStream', 'identify'].sort(),
    );
    const api = Object.fromEntries(mock.exposed) as RemoteApi;
    expect(Object.keys(api.mediaStream).sort()).toEqual([
      'clearSrcObject',
      'reconnect',
      'updateSrcObject',
    ]);
    expect(PreviewSocket.instances).toHaveLength(1);
    expect(PreviewSocket.instances[0].url).toBe('ws://preview-host:9002');
    api.mediaStream.reconnect();
    expect(PreviewSocket.instances[0].close).toHaveBeenCalledOnce();
    expect(PreviewSocket.instances).toHaveLength(2);
  });
});
