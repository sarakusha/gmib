import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  register: vi.fn(),
  watch: vi.fn(),
  getPlayer: vi.fn(),
  activateMain: vi.fn(),
  auth: vi.fn(),
  resolveMain: undefined as undefined | (() => void),
}));
vi.mock('electron', () => ({ app: { once: vi.fn(), isPackaged: true }, dialog: {} }));
vi.mock('../src/authRequest', () => ({ default: mock.auth }));
vi.mock('../src/db', () => ({ dbReady: Promise.resolve() }));
vi.mock('../src/localConfig', () => ({ default: { get: vi.fn() } }));
vi.mock('../src/mainWindow', () => ({
  default: new Promise<void>(resolve => {
    mock.resolveMain = resolve;
  }),
  activateMainWindow: mock.activateMain,
}));
vi.mock('../src/openHandler', () => ({ installWindowOpenHandler: vi.fn() }));
vi.mock('../src/licenseState', () => ({
  getLicenseState: () => ({ status: 'active', plan: 'plus' }),
}));
vi.mock('../src/playerOutputHealth', () => ({ watchPlayerOutput: mock.watch }));
vi.mock('../src/relaunch', () => ({ default: vi.fn(), needRestart: vi.fn() }));
vi.mock('../src/screen', () => ({
  getPlayer: mock.getPlayer,
  getPlayers: vi.fn(),
  isPlayerActive: vi.fn(),
  updateShowPlayer: vi.fn(),
}));
vi.mock('../src/tabbedWindow', () => ({ createTabbedWindow: mock.create }));
vi.mock('../src/windowStore', () => ({
  findPlayerWindow: mock.find,
  registerPlayer: mock.register,
  getAllGmibParams: () => [],
}));

import type { GmibWindowParams } from '/@common/WindowParams';
import { openPlayer } from '../src/playerWindow';

const params = { id: 0, type: 'gmib', host: 'localhost', nibusPort: 19001 } as GmibWindowParams;
const createWindow = () =>
  Object.assign(new EventEmitter(), {
    id: 12,
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    loadURL: vi.fn(async () => undefined),
    webContents: Object.assign(new EventEmitter(), {
      send: vi.fn(),
      setVisualZoomLevelLimits: vi.fn(async () => undefined),
    }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.find.mockReturnValue(undefined);
  mock.getPlayer.mockResolvedValue({ id: 1, name: 'Local' });
});

describe('hidden local player startup', () => {
  it('opens before the main GMIB window exists without activating any tab', async () => {
    const window = createWindow();
    mock.create.mockReturnValue(window);
    const opening = openPlayer(1, { hidden: true, gmibParams: params });
    await vi.waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1), { timeout: 300 });
    expect(await opening).toBe(window);
    // Startup's later launchPlayers pass can request the same hidden player.
    mock.find.mockReturnValue(window);
    expect(await openPlayer(1, { hidden: true, gmibParams: params })).toBe(window);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.register).toHaveBeenCalledWith(
      window,
      { host: 'localhost', port: 19001, playerId: 1 },
      params,
    );
    expect(window.loadURL).toHaveBeenCalledWith(
      'http://localhost:19002/player.html?source_id=1&host=localhost&port=19001',
    );
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
    expect(mock.activateMain).not.toHaveBeenCalled();
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it('keeps a concurrently created existing player hidden instead of focusing it', async () => {
    const window = createWindow();
    mock.find.mockReturnValue(window);
    expect(await openPlayer(1, { hidden: true, gmibParams: params })).toBe(window);
    expect(mock.create).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith('updateVideoOuts');
  });

  it('retains foreground startup waiting and existing-window activation', async () => {
    const window = createWindow();
    mock.find.mockReturnValue(window);
    let completed = false;
    const opening = openPlayer(1, { gmibParams: params }).then(value => {
      completed = true;
      return value;
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(window.show).not.toHaveBeenCalled();
    mock.resolveMain!();
    expect(await opening).toBe(window);
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
  });
});
