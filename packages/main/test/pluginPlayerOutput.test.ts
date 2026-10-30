import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  getScreen: vi.fn(),
  getScreens: vi.fn(),
  updateScreen: vi.fn(),
  updateTest: vi.fn(),
  getScreenOutputError: vi.fn(),
  getPlayer: vi.fn(),
  getPlayers: vi.fn(),
  updatePlayer: vi.fn(),
  openPlayer: vi.fn(),
  findPlayerWindow: vi.fn(),
  getAllGmibParams: vi.fn(),
  visibility: vi.fn(),
  send: vi.fn(),
  broadcast: vi.fn(),
  findScreenWindow: vi.fn(),
  setScreenOutputHidden: vi.fn(),
  clearScreenOutputVisibility: vi.fn(),
  revealPlayerOutput: vi.fn(),
}));
vi.mock('electron', () => ({
  screen: { on: vi.fn(), off: vi.fn(), getAllDisplays: () => [{ id: 1 }] },
}));
vi.mock('../src/outputVisibility', () => ({
  setScreenOutputHidden: mock.setScreenOutputHidden,
  clearScreenOutputVisibility: mock.clearScreenOutputVisibility,
  revealPlayerOutput: mock.revealPlayerOutput,
}));
vi.mock('../src/screen', () => mock);
vi.mock('../src/screenOutput', () => ({
  updateTest: mock.updateTest,
  getScreenOutputError: mock.getScreenOutputError,
}));
vi.mock('../src/openHandler', () => ({
  setPlayerOutputWindowsVisibility: mock.visibility,
}));
vi.mock('../src/playerWindow', () => ({ openPlayer: mock.openPlayer }));
vi.mock('../src/windowStore', () => ({
  findPlayerWindow: mock.findPlayerWindow,
  findScreenWindow: mock.findScreenWindow,
  getAllGmibParams: mock.getAllGmibParams,
}));
vi.mock('../src/server', () => ({ broadcast: mock.broadcast }));

import type { PluginManifest } from '/@common/plugins';
import { createPluginOutput } from '../src/pluginOutput';

const manifest: PluginManifest = {
  id: 'test',
  name: 'test',
  version: '1.0.0',
  gmibApi: '^1.1.0',
  permissions: ['output.control', 'player.control'],
  pages: [{ id: 'main', title: 'Main', path: 'index.html' }],
};
const createApi = (value = manifest) =>
  createPluginOutput(value, { get: async () => undefined, set: vi.fn() }, vi.fn());
const player = { id: 1, name: 'Player', playlistId: 5, autoPlay: false, current: 'media-id' };
const window = { webContents: { send: mock.send } };

beforeEach(() => {
  vi.resetAllMocks();
  mock.getScreens.mockResolvedValue([]);
  mock.getPlayer.mockResolvedValue(player);
  mock.getPlayers.mockResolvedValue([player, { id: 2, autoPlay: true }]);
  mock.getAllGmibParams.mockReturnValue([
    { host: 'remote', nibusPort: 9000 },
    { host: 'localhost', nibusPort: 9001 },
  ]);
  mock.findPlayerWindow.mockReturnValue(window);
  mock.openPlayer.mockResolvedValue(window);
});

describe('plugin player output', () => {
  it('lists players with their current playback state', async () => {
    const api = await createApi();
    expect(await api.listPlayers?.()).toEqual([
      { id: 1, name: 'Player', playing: false },
      { id: 2, name: 'player#2', playing: true },
    ]);
  });

  it('reuses the runtime without opening or focusing its tab and shows output', async () => {
    const api = await createApi();
    await api.setPlayerState?.({ playerId: 1, playing: true });
    expect(mock.openPlayer).not.toHaveBeenCalled();
    expect(mock.updatePlayer).toHaveBeenCalledWith({ ...player, autoPlay: true });
    expect(mock.send).toHaveBeenCalledWith('player', player, { restart: undefined });
    expect(mock.broadcast).toHaveBeenCalledWith({ event: 'player', all: true });
    expect(mock.visibility).toHaveBeenCalledWith(true, 1);
  });

  it('persists autoplay before opening a missing runtime hidden on localhost', async () => {
    mock.findPlayerWindow.mockReturnValueOnce(undefined);
    const api = await createApi();
    await api.setPlayerState?.({ playerId: 1, playing: true });
    expect(mock.openPlayer).toHaveBeenCalledWith(1, {
      hidden: true,
      gmibParams: { host: 'localhost', nibusPort: 9001 },
    });
    expect(mock.openPlayer.mock.invocationCallOrder[0]).toBeGreaterThan(
      mock.updatePlayer.mock.invocationCallOrder[0],
    );
  });

  it('stops playback, clears the current item, sends stop and hides the output', async () => {
    const api = await createApi();
    await api.setPlayerState?.({ playerId: 1, playing: false });
    expect(mock.updatePlayer).toHaveBeenCalledWith({
      ...player,
      current: undefined,
      autoPlay: false,
    });
    expect(mock.send).toHaveBeenCalledWith('stop', 1);
    expect(mock.visibility).toHaveBeenCalledWith(false, 1);
    expect(mock.openPlayer).not.toHaveBeenCalled();
  });

  it('checks output.control for both new methods', async () => {
    const api = await createApi({ ...manifest, permissions: [] });
    await expect(api.listPlayers?.()).rejects.toThrow('player.control');
    expect(() => api.setPlayerState?.({ playerId: 1, playing: true })).toThrow('player.control');
    expect(mock.getPlayers).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it.each([NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid player id %s', async id => {
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: id, playing: true })).rejects.toThrow(
      'Некорректное',
    );
    expect(mock.getPlayer).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(mock.visibility).not.toHaveBeenCalled();
  });

  it('does not infer player.control from output.control', async () => {
    const api = await createApi({ ...manifest, permissions: ['output.control'] });
    await expect(api.listPlayers?.()).rejects.toThrow('player.control');
    expect(() => api.setPlayerState?.({ playerId: 1, playing: true })).toThrow('player.control');
    expect(mock.getPlayers).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it('rejects playback without a selected playlist', async () => {
    mock.getPlayer.mockResolvedValue({ ...player, playlistId: undefined });
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 1, playing: true })).rejects.toThrow('плейлист');
    expect(mock.openPlayer).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it('can still stop and hide a player removed from the database', async () => {
    mock.getPlayer.mockResolvedValue(undefined);
    const api = await createApi();
    await api.setPlayerState?.({ playerId: 99, playing: false });
    expect(mock.send).toHaveBeenCalledWith('stop', 99);
    expect(mock.visibility).toHaveBeenCalledWith(false, 99);
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it('does not auto-restore saved output after its permission was revoked', async () => {
    const { screen } = await import('electron');
    const api = await createPluginOutput(
      { ...manifest, permissions: [] },
      {
        get: async () => ({ screenId: 1, pageId: 'main', autoStart: true }) as never,
        set: vi.fn(),
      },
      vi.fn(),
    );
    const added = vi
      .mocked(screen.on)
      .mock.calls.findLast(([event]) => event === 'display-added')?.[1];
    added?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(mock.getScreen).not.toHaveBeenCalled();
    expect(mock.updateTest).not.toHaveBeenCalled();
    expect(api).toBeDefined();
  });

  it('rejects missing players before any mutation', async () => {
    mock.getPlayer.mockResolvedValue(undefined);
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 99, playing: true })).rejects.toThrow(
      'не найден',
    );
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(mock.visibility).not.toHaveBeenCalled();
  });

  it.each(['undefined', 'throw'])('rolls back a failed hidden launch (%s)', async failure => {
    mock.findPlayerWindow.mockReturnValue(undefined);
    if (failure === 'throw') mock.openPlayer.mockRejectedValue(new Error('launch failed'));
    else mock.openPlayer.mockResolvedValue(undefined);
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 1, playing: true })).rejects.toThrow(
      failure === 'throw' ? 'launch failed' : 'Не удалось открыть',
    );
    expect(mock.updatePlayer.mock.calls).toEqual([[{ ...player, autoPlay: true }], [player]]);
    expect(mock.visibility).not.toHaveBeenCalled();
    expect(mock.revealPlayerOutput).not.toHaveBeenCalled();
  });

  it('checks local server readiness before mutating playback', async () => {
    mock.findPlayerWindow.mockReturnValue(undefined);
    mock.getAllGmibParams.mockReturnValue([{ host: 'remote', nibusPort: 9000 }]);
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 1, playing: true })).rejects.toThrow(
      'ещё не готов',
    );
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(mock.openPlayer).not.toHaveBeenCalled();
  });

  it('reports both launch and rollback failures', async () => {
    mock.findPlayerWindow.mockReturnValue(undefined);
    const launchError = new Error('launch failed');
    const rollbackError = new Error('rollback failed');
    mock.openPlayer.mockRejectedValue(launchError);
    mock.updatePlayer.mockResolvedValueOnce(undefined).mockRejectedValueOnce(rollbackError);
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 1, playing: true })).rejects.toMatchObject({
      errors: [launchError, rollbackError],
    });
    expect(mock.visibility).not.toHaveBeenCalled();
  });

  it('propagates persistence errors and keeps the operation queue usable', async () => {
    mock.updatePlayer.mockRejectedValueOnce(new Error('database failed'));
    const api = await createApi();
    await expect(api.setPlayerState?.({ playerId: 1, playing: true })).rejects.toThrow(
      'database failed',
    );
    expect(mock.visibility).not.toHaveBeenCalled();
    await api.setPlayerState?.({ playerId: 1, playing: false });
    expect(mock.visibility).toHaveBeenCalledWith(false, 1);
  });

  it('clears every stale owned output before enabling the selected screen', async () => {
    const target = { id: 3, display: 1, width: 100, height: 100 };
    const stale = [
      { id: 1, test: 'plugin:test:main' },
      { id: 2, test: 'plugin:test:old-page' },
    ];
    // Factory cleanup is intentionally skipped here to simulate stale screens
    // that appear after the plugin has initialized.
    const api = await createApi();
    mock.getScreen.mockResolvedValue(target);
    mock.getScreens.mockResolvedValue([...stale, target, { id: 4, test: 'plugin:other:main' }]);
    await api.start({ screenId: 3, pageId: 'main', autoStart: false });
    expect(mock.updateTest.mock.calls).toEqual([
      [{ ...stale[0], test: undefined }],
      [{ ...stale[1], test: undefined }],
      [{ ...target, test: 'plugin:test:main' }],
    ]);
    mock.updateTest.mockClear();
    mock.updateScreen.mockClear();
    await api.stop();
    expect(mock.updateTest.mock.calls).toEqual([
      [{ ...stale[0], test: undefined }],
      [{ ...stale[1], test: undefined }],
    ]);
  });

  it('reports a configured but globally hidden output as inactive', async () => {
    const api = await createApi();
    mock.getScreen.mockResolvedValue({
      id: 1,
      display: 1,
      width: 100,
      height: 100,
      test: 'plugin:test:main',
    });
    await api.start({ screenId: 1, pageId: 'main', autoStart: false });
    expect(mock.setScreenOutputHidden).toHaveBeenCalledWith(1, false);
    mock.findScreenWindow.mockReturnValue({
      isDestroyed: () => false,
      isVisible: () => true,
    });
    expect((await api.getStatus()).active).toBe(true);
    mock.findScreenWindow.mockReturnValue({
      isDestroyed: () => false,
      isVisible: () => false,
    });
    expect((await api.getStatus()).active).toBe(false);
    mock.findScreenWindow.mockReturnValue(undefined);
    expect((await api.getStatus()).active).toBe(false);
  });

  it('rejects a failed page load and does not report its visible error window as active', async () => {
    const api = await createApi();
    const scr = { id: 1, display: 1, width: 100, height: 100, test: 'plugin:test:main' };
    mock.getScreen.mockResolvedValue(scr);
    mock.findScreenWindow.mockReturnValue({ isDestroyed: () => false, isVisible: () => true });
    mock.getScreenOutputError.mockReturnValue('Не удалось загрузить страницу вывода (HTTP 404)');
    await expect(api.start({ screenId: 1, pageId: 'main', autoStart: false })).rejects.toThrow(
      'HTTP 404',
    );
    expect(await api.getStatus()).toMatchObject({
      active: false,
      message: expect.stringContaining('HTTP 404'),
    });
    mock.getScreenOutputError.mockReturnValue(undefined);
    await api.start({ screenId: 1, pageId: 'main', autoStart: false });
    expect(await api.getStatus()).toMatchObject({ active: true, message: 'Вывод включён' });
    mock.getScreenOutputError.mockReturnValue('Old failure');
    mock.getScreen.mockResolvedValue({ ...scr, test: undefined });
    expect(await api.getStatus()).toMatchObject({ active: false, message: 'Вывод выключен' });
  });

  it('serializes player state changes with screen start and stop operations', async () => {
    let release!: () => void;
    mock.getScreen.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = () => resolve({ id: 1, display: 1, width: 100, height: 100 });
        }),
    );
    mock.getScreen.mockResolvedValue({ id: 1, test: 'plugin:test:main' });
    const api = await createApi();
    mock.getScreens.mockResolvedValue([{ id: 1, test: 'plugin:test:main' }]);
    const starting = api.start({ screenId: 1, pageId: 'main', autoStart: false });
    await vi.waitFor(() => expect(mock.getScreen).toHaveBeenCalledTimes(1));
    const playing = api.setPlayerState?.({ playerId: 1, playing: true });
    const stopping = api.stop();
    expect(mock.getPlayer).not.toHaveBeenCalled();
    release();
    await Promise.all([starting, playing, stopping]);
    expect(mock.getPlayer.mock.invocationCallOrder[0]).toBeGreaterThan(
      mock.updateTest.mock.invocationCallOrder[0],
    );
    expect(mock.updateTest.mock.invocationCallOrder[1]).toBeGreaterThan(
      mock.visibility.mock.invocationCallOrder[0],
    );
  });
});
