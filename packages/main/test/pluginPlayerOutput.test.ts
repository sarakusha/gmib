import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  getLicenseState: vi.fn(),
  getLocalConfig: vi.fn(),
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
  holdOutputWindows: vi.fn(),
  releaseOutputWindows: vi.fn(),
  waitForPluginPlayerReady: vi.fn(),
  waitForPluginOutputSettle: vi.fn(),
  getOutputVisibilityRevision: vi.fn(),
  clearPlayerOutputReveal: vi.fn(),
  reconcilePlayerOutputWindows: vi.fn(),
  isScreenOutputHidden: vi.fn(),
  isPlayerOutputHidden: vi.fn(),
}));
vi.mock('electron', () => ({
  screen: { on: vi.fn(), off: vi.fn(), getAllDisplays: () => [{ id: 1 }] },
}));
vi.mock('../src/outputVisibility', () => ({
  setScreenOutputHidden: mock.setScreenOutputHidden,
  clearScreenOutputVisibility: mock.clearScreenOutputVisibility,
  clearPlayerOutputReveal: mock.clearPlayerOutputReveal,
  getOutputVisibilityRevision: mock.getOutputVisibilityRevision,
  revealPlayerOutput: mock.revealPlayerOutput,
  isScreenOutputHidden: mock.isScreenOutputHidden,
  isPlayerOutputHidden: mock.isPlayerOutputHidden,
}));
vi.mock('../src/screen', () => mock);
vi.mock('../src/screenOutput', () => ({
  updateTest: mock.updateTest,
  getScreenOutputError: mock.getScreenOutputError,
}));
vi.mock('../src/openHandler', () => ({
  setPlayerOutputWindowsVisibility: mock.visibility,
  holdOutputWindows: mock.holdOutputWindows,
  reconcilePlayerOutputWindows: mock.reconcilePlayerOutputWindows,
}));
vi.mock('../src/pluginOutputTransition', () => ({
  waitForPluginPlayerReady: mock.waitForPluginPlayerReady,
  waitForPluginOutputSettle: mock.waitForPluginOutputSettle,
}));
vi.mock('../src/playerWindow', () => ({ openPlayer: mock.openPlayer }));
vi.mock('../src/windowStore', () => ({
  findPlayerWindow: mock.findPlayerWindow,
  findScreenWindow: mock.findScreenWindow,
  getAllGmibParams: mock.getAllGmibParams,
}));
vi.mock('../src/server', () => ({ broadcast: mock.broadcast }));
vi.mock('../src/config', () => ({ port: 19002 }));
vi.mock('../src/licenseState', () => ({ getLicenseState: mock.getLicenseState }));
vi.mock('../src/localConfig', () => ({ default: { get: mock.getLocalConfig } }));

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
  mock.getLicenseState.mockReturnValue({
    status: 'active',
    plan: 'plus',
    capabilities: ['plugins'],
  });
  mock.getLocalConfig.mockImplementation((key: string) => key === 'autostart');
  mock.getOutputVisibilityRevision.mockReturnValue(0);
  mock.holdOutputWindows.mockReturnValue(mock.releaseOutputWindows);
  mock.isScreenOutputHidden.mockReturnValue(false);
  mock.isPlayerOutputHidden.mockReturnValue(false);
  mock.findScreenWindow.mockReturnValue({ isDestroyed: () => false, isVisible: () => true });
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

  it.each([{ tabs: [] }, { tabs: [{ host: 'remote-only', nibusPort: 9999 }] }])(
    'starts locally without a registered local GMIB tab (%j)',
    async ({ tabs }) => {
      mock.findPlayerWindow.mockReturnValue(undefined);
      mock.getAllGmibParams.mockReturnValue(tabs);
      const api = await createApi();
      await api.setPlayerState?.({ playerId: 1, playing: true });
      expect(mock.openPlayer).toHaveBeenCalledWith(1, {
        hidden: true,
        gmibParams: expect.objectContaining({
          host: 'localhost',
          nibusPort: 19001,
          type: 'gmib',
          licenseState: { status: 'active', plan: 'plus', capabilities: ['plugins'] },
          autostart: true,
        }),
      });
      expect(mock.openPlayer.mock.invocationCallOrder[0]).toBeGreaterThan(
        mock.updatePlayer.mock.invocationCallOrder[0],
      );
      expect(mock.visibility).toHaveBeenCalledWith(true, 1);
    },
  );

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

  it('prepares the selected screen before clearing every stale owned output', async () => {
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
      [{ ...target, test: 'plugin:test:main' }],
      [{ ...stale[0], test: undefined }],
      [{ ...stale[1], test: undefined }],
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
      message: 'Экран ещё не выбран',
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

describe('atomic plugin output layouts', () => {
  const priorProfile = { screenId: 1, pageId: 'main', autoStart: false };
  const nextProfile = { screenId: 3, pageId: 'main', autoStart: true };
  const setup = async (pluginManifest = manifest) => {
    const storage = { get: async () => priorProfile as never, set: vi.fn() };
    const api = await createPluginOutput(pluginManifest, storage, vi.fn());
    const screens = new Map([
      [
        1,
        {
          id: 1,
          display: 1,
          width: 100,
          height: 100,
          test: 'plugin:test:main' as string | undefined,
        },
      ],
      [3, { id: 3, display: 1, width: 50, height: 100, test: undefined as string | undefined }],
    ]);
    mock.getScreens.mockImplementation(async () =>
      [...screens.values()].map(value => ({ ...value })),
    );
    mock.getScreen.mockImplementation(async (id: number) => {
      const value = screens.get(id);
      return value && { ...value };
    });
    mock.updateScreen.mockImplementation(async value => {
      screens.set(value.id, { ...value });
    });
    const players = new Map([
      [7, { ...player, id: 7, autoPlay: false }],
      [8, { ...player, id: 8, autoPlay: true }],
    ]);
    mock.getPlayer.mockImplementation(async (id: number) => {
      const value = players.get(id);
      return value && { ...value };
    });
    mock.updatePlayer.mockImplementation(async value => {
      players.set(value.id, { ...value });
    });
    return { api, storage, screens, players };
  };

  it('keeps prior output pinned until the new screen and started player are ready', async () => {
    const state = await setup();
    let ready!: () => void;
    mock.waitForPluginPlayerReady.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          ready = resolve;
        }),
    );
    const transition = state.api.applyLayout!({
      profile: nextProfile,
      players: [
        { playerId: 8, playing: false },
        { playerId: 7, playing: true },
      ],
    });
    await vi.waitFor(() => expect(mock.waitForPluginPlayerReady).toHaveBeenCalledWith(7));
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.players.get(8)?.autoPlay).toBe(true);
    expect(state.storage.set).not.toHaveBeenCalled();
    expect(mock.releaseOutputWindows).not.toHaveBeenCalled();
    expect(mock.holdOutputWindows).toHaveBeenCalledTimes(1);
    ready();
    await transition;
    expect(state.screens.get(1)?.test).toBeUndefined();
    expect(state.screens.get(3)?.test).toBe('plugin:test:main');
    expect(state.players.get(7)?.autoPlay).toBe(true);
    expect(state.players.get(8)?.autoPlay).toBe(false);
    expect(state.storage.set).toHaveBeenCalledWith('gmib.output', nextProfile);
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
    const firstScreen = mock.updateTest.mock.calls[0][0];
    expect(firstScreen.id).toBe(3);
  });

  it('retains the previous screen and restores touched playback after readiness fails', async () => {
    const state = await setup();
    mock.waitForPluginPlayerReady.mockRejectedValueOnce(new Error('player not ready'));
    await expect(
      state.api.applyLayout!({ profile: nextProfile, players: [{ playerId: 7, playing: true }] }),
    ).rejects.toThrow('player not ready');
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect(state.players.get(7)?.autoPlay).toBe(false);
    expect((await state.api.getStatus()).profile).toEqual(priorProfile);
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('restores cleared screens if committing the saved profile fails', async () => {
    const state = await setup();
    state.storage.set.mockRejectedValueOnce(new Error('storage failed'));
    await expect(state.api.applyLayout!({ profile: nextProfile })).rejects.toThrow(
      'storage failed',
    );
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect((await state.api.getStatus()).profile).toEqual(priorProfile);
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('rejects page errors without clearing or replacing the saved previous output', async () => {
    const state = await setup();
    mock.getScreenOutputError.mockImplementation((id: number) =>
      id === 3 ? 'HTTP 404' : undefined,
    );
    await expect(state.api.start(nextProfile)).rejects.toThrow('HTTP 404');
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect((await state.api.getStatus()).profile).toEqual(priorProfile);
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('rejects a disconnected target display before affecting the previous output', async () => {
    const state = await setup();
    state.screens.set(3, { ...state.screens.get(3)!, display: 99 });
    await expect(state.api.applyLayout!({ profile: nextProfile })).rejects.toThrow('Дисплей');
    expect(mock.updateScreen).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
  });

  it('requires player.control only when player operations are requested', async () => {
    const api = await createApi({ ...manifest, permissions: ['output.control'] });
    expect(() =>
      api.applyLayout!({ profile: nextProfile, players: [{ playerId: 1, playing: true }] }),
    ).toThrow('player.control');
    expect(mock.updateScreen).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it.each([
    [{ playerId: NaN, playing: true }],
    [{ playerId: 7, playing: 'true' }],
    [
      { playerId: 7, playing: true },
      { playerId: 7, playing: false },
    ],
    [
      { playerId: 7, playing: true },
      { playerId: 99, playing: false },
    ],
  ])('validates the complete player list before any mutation (%j)', async players => {
    const state = await setup();
    await expect(
      state.api.applyLayout!({ profile: nextProfile, players } as never),
    ).rejects.toThrow();
    expect(mock.updateScreen).not.toHaveBeenCalled();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
  });

  it('requires output.control before inspecting any player or screen', async () => {
    const api = await createApi({ ...manifest, permissions: ['player.control'] });
    expect(() =>
      api.applyLayout!({ profile: nextProfile, players: [{ playerId: 1, playing: true }] }),
    ).toThrow('output.control');
    expect(mock.getPlayer).not.toHaveBeenCalled();
    expect(mock.getScreen).not.toHaveBeenCalled();
  });

  it('allows a screen-only atomic layout without player.control', async () => {
    const state = await setup({ ...manifest, permissions: ['output.control'] });
    await state.api.applyLayout!({ profile: nextProfile, players: [] });
    expect(state.screens.get(3)?.test).toBe('plugin:test:main');
    expect(mock.updatePlayer).not.toHaveBeenCalled();
  });

  it('retains the previous output when the prepared target is not visible', async () => {
    const state = await setup();
    mock.findScreenWindow.mockImplementation((id: number) => ({
      isDestroyed: () => false,
      isVisible: () => id !== 3,
    }));
    await expect(state.api.applyLayout!({ profile: nextProfile })).rejects.toThrow('не появился');
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('restores full original player rows when stopping an old player fails', async () => {
    const state = await setup();
    mock.updatePlayer.mockImplementation(async value => {
      if (value.id === 8 && !value.autoPlay) throw new Error('stop failed');
      state.players.set(value.id, { ...value });
    });
    await expect(
      state.api.applyLayout!({
        profile: nextProfile,
        players: [
          { playerId: 7, playing: true },
          { playerId: 8, playing: false },
        ],
      }),
    ).rejects.toThrow('stop failed');
    expect(state.players.get(7)).toEqual({ ...player, id: 7, autoPlay: false });
    expect(state.players.get(8)).toEqual({ ...player, id: 8, autoPlay: true });
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('reports rollback errors while still restoring screens and releasing the pin', async () => {
    const state = await setup();
    const initialError = new Error('not ready');
    const rollbackError = new Error('rollback player failed');
    mock.waitForPluginPlayerReady.mockRejectedValueOnce(initialError);
    mock.updatePlayer
      .mockImplementationOnce(async value => {
        state.players.set(value.id, { ...value });
      })
      .mockRejectedValueOnce(rollbackError);
    await expect(
      state.api.applyLayout!({ profile: nextProfile, players: [{ playerId: 7, playing: true }] }),
    ).rejects.toMatchObject({ errors: [initialError, rollbackError] });
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('does not re-show output after a newer global hide while waiting for readiness', async () => {
    const state = await setup();
    let rejectReady!: (error: Error) => void;
    mock.waitForPluginPlayerReady.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectReady = reject;
        }),
    );
    const transition = state.api.applyLayout!({
      profile: nextProfile,
      players: [{ playerId: 7, playing: true }],
    });
    const failed = expect(transition).rejects.toThrow('not ready');
    await vi.waitFor(() => expect(mock.waitForPluginPlayerReady).toHaveBeenCalled());
    mock.getOutputVisibilityRevision.mockReturnValue(1);
    mock.isScreenOutputHidden.mockReturnValue(true);
    mock.isPlayerOutputHidden.mockReturnValue(true);
    mock.revealPlayerOutput.mockClear();
    mock.setScreenOutputHidden.mockClear();
    mock.visibility.mockClear();
    rejectReady(new Error('not ready'));
    await failed;
    expect(mock.revealPlayerOutput).not.toHaveBeenCalled();
    expect(mock.setScreenOutputHidden).not.toHaveBeenCalled();
    expect(mock.clearScreenOutputVisibility).toHaveBeenCalledWith(3);
    expect(mock.clearPlayerOutputReveal).toHaveBeenCalledWith(7);
    expect(mock.reconcilePlayerOutputWindows).toHaveBeenCalledWith(7);
    expect(mock.visibility).not.toHaveBeenCalled();
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
  });

  it('aborts before handoff after global visibility changes while preparing a frame', async () => {
    const state = await setup();
    let ready!: () => void;
    mock.waitForPluginOutputSettle.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          ready = resolve;
        }),
    );
    const transition = state.api.applyLayout!({
      profile: nextProfile,
      players: [{ playerId: 8, playing: false }],
    });
    const failed = expect(transition).rejects.toThrow('общей командой');
    await vi.waitFor(() => expect(mock.waitForPluginOutputSettle).toHaveBeenCalled());
    expect(state.players.get(8)?.autoPlay).toBe(true);
    mock.getOutputVisibilityRevision.mockReturnValue(1);
    ready();
    await failed;
    expect(state.players.get(8)?.autoPlay).toBe(true);
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
  });

  it('snapshots queued applyLayout input before the caller can append player operations', async () => {
    const state = await setup({ ...manifest, permissions: ['output.control'] });
    let frame!: () => void;
    mock.waitForPluginOutputSettle.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          frame = resolve;
        }),
    );
    const first = state.api.start(nextProfile);
    await vi.waitFor(() => expect(mock.waitForPluginOutputSettle).toHaveBeenCalled());
    const layout = {
      profile: { ...nextProfile },
      players: [] as Array<{ playerId: number; playing: boolean }>,
    };
    const queued = state.api.applyLayout!(layout);
    layout.players.push({ playerId: 7, playing: true });
    layout.profile.screenId = 99;
    frame();
    await Promise.all([first, queued]);
    expect(mock.updatePlayer).not.toHaveBeenCalled();
    expect(state.storage.set).toHaveBeenLastCalledWith('gmib.output', nextProfile);
  });

  it('allows idempotent cleanup of an already deleted player', async () => {
    const state = await setup();
    await state.api.applyLayout!({
      profile: nextProfile,
      players: [{ playerId: 99, playing: false }],
    });
    expect(mock.send).toHaveBeenCalledWith('stop', 99);
    expect(mock.visibility).toHaveBeenCalledWith(false, 99);
    expect(state.screens.get(3)?.test).toBe('plugin:test:main');
  });

  it('keeps the prepared picture and reports rollback load errors if the old page cannot return', async () => {
    const state = await setup();
    state.storage.set.mockRejectedValueOnce(new Error('storage failed'));
    mock.getScreenOutputError.mockImplementation((id: number) =>
      id === 1 ? 'HTTP 503' : undefined,
    );
    await expect(state.api.applyLayout!({ profile: nextProfile })).rejects.toMatchObject({
      errors: [
        expect.objectContaining({ message: 'storage failed' }),
        expect.objectContaining({ message: expect.stringContaining('HTTP 503') }),
      ],
    });
    expect(state.screens.get(3)?.test).toBe('plugin:test:main');
    expect(mock.releaseOutputWindows).toHaveBeenCalledTimes(1);
  });

  it('shares the operation queue with stop while waiting for readiness', async () => {
    const state = await setup();
    let ready!: () => void;
    mock.waitForPluginPlayerReady.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          ready = resolve;
        }),
    );
    const transition = state.api.applyLayout!({
      profile: nextProfile,
      players: [{ playerId: 7, playing: true }],
    });
    await vi.waitFor(() => expect(mock.waitForPluginPlayerReady).toHaveBeenCalled());
    const stopping = state.api.stop();
    expect(state.screens.get(1)?.test).toBe('plugin:test:main');
    ready();
    await Promise.all([transition, stopping]);
    expect(state.screens.get(3)?.test).toBeUndefined();
    expect((await state.api.getStatus()).profile?.autoStart).toBe(false);
  });
});
