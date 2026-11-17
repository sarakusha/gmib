import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  params: vi.fn(),
  serials: vi.fn(),
  inspect: vi.fn(),
  repair: vi.fn(),
  commands: vi.fn(),
  setAutomatic: vi.fn(),
  automaticCommands: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { isPackaged: true, whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (name: string, handler: (...args: any[]) => any) => mocks.handlers.set(name, handler),
  },
}));
vi.mock('../src/windowStore', () => ({ findParamsByWebContentsId: mocks.params }));
vi.mock('../src/config', () => ({ port: 9002 }));
vi.mock('../src/MasterBrowser', () => ({ default: { getDiscoveredTaurusSerials: mocks.serials } }));
vi.mock('../src/windowsTaurusRoutes', () => ({ createWindowsTaurusRoutes: () => mocks }));
vi.mock('../src/linuxTaurusRoutes', () => ({
  inspectLinuxTaurusRoutes: vi.fn(),
  repairLinuxTaurusRoutes: vi.fn(),
  buildLinuxTaurusRouteCommand: vi.fn(),
  configureLinuxTaurusAutomatic: vi.fn(),
  buildLinuxTaurusAutomaticCommand: vi.fn(),
}));

const deviceId = 'USB\\VID_2207&PID_0013\\26707A000004040';
const snapshot = (elevated = true) => ({
  supported: true,
  platform: 'win32',
  elevated,
  adapters: [{ deviceId, serialNumber: '26707A000004040' }],
});
const event = () => {
  const frame = {
    origin: 'http://localhost:9002',
    url: 'http://localhost:9002/index.html?host=localhost',
  };
  return { senderFrame: frame, sender: { id: 1, mainFrame: frame } };
};
const invoke = (method: string, sender = event(), ...args: unknown[]) =>
  mocks.handlers.get(`windowsTaurusRoutes:${method}`)!(sender, ...args);

describe('local Taurus network IPC boundary', () => {
  const originalPlatform = process.platform;
  beforeAll(async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    await import('../src/taurusRoutesIpc');
  });
  afterAll(() => Object.defineProperty(process, 'platform', { value: originalPlatform }));
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.mockReturnValue({ type: 'gmib', host: 'localhost', nibusPort: 9001 });
    mocks.serials.mockReturnValue(['26707a000004040']);
    mocks.inspect.mockResolvedValue(snapshot());
    mocks.commands.mockReturnValue('safe command');
    mocks.automaticCommands.mockReturnValue('safe setup');
  });
  it('confirms the exact USB serial against the existing discovery cache', async () => {
    expect((await invoke('inspect')).adapters[0].confirmedTaurus).toBe(true);
    mocks.serials.mockReturnValue(['4040']);
    expect((await invoke('inspect')).adapters[0].confirmedTaurus).toBe(false);
  });
  it.each(['inspect', 'repair', 'commands', 'setAutomatic', 'automaticCommands'])(
    'rejects remote host %s before invoking system tools',
    method => {
      mocks.params.mockReturnValue({ type: 'gmib', host: '192.168.1.10' });
      expect(() => invoke(method, event(), deviceId, true)).toThrow('локальном');
      expect(mocks.inspect).not.toHaveBeenCalled();
    },
  );
  it('rejects subframes, redirected pages and non-GMIB windows', () => {
    const child = event();
    child.sender.mainFrame = { ...child.senderFrame };
    expect(() => invoke('inspect', child)).toThrow();
    const foreign = event();
    foreign.senderFrame.origin = 'https://example.com';
    expect(() => invoke('inspect', foreign)).toThrow();
    const otherPage = event();
    otherPage.senderFrame.url = 'http://localhost:9002/player.html';
    expect(() => invoke('inspect', otherPage)).toThrow();
    mocks.params.mockReturnValue({ type: 'player', host: 'localhost' });
    expect(() => invoke('inspect')).toThrow();
  });
  it('rechecks presence and elevation before mutations but allows copying without elevation', async () => {
    mocks.inspect.mockResolvedValue(snapshot(false));
    await expect(invoke('repair', event(), deviceId)).rejects.toThrow('права администратора');
    await expect(invoke('commands', event(), deviceId)).resolves.toBe('safe command');
    await expect(invoke('setAutomatic', event(), deviceId, true)).rejects.toThrow(
      'права администратора',
    );
    await expect(invoke('automaticCommands', event(), deviceId, true)).resolves.toBe('safe setup');
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(mocks.setAutomatic).not.toHaveBeenCalled();
    mocks.inspect.mockResolvedValue({ ...snapshot(), adapters: [] });
    await expect(invoke('repair', event(), deviceId)).rejects.toThrow('отключено');
  });
  it('rejects arbitrary command/adapter input and invalid mode', async () => {
    await expect(invoke('repair', event(), 'Ethernet 47')).rejects.toThrow('отключено');
    await expect(invoke('setAutomatic', event(), deviceId, 'true')).rejects.toThrow('операция');
    expect(mocks.repair).not.toHaveBeenCalled();
  });
  it('serializes concurrent repairs across windows and recovers from a failed request', async () => {
    let release!: () => void;
    mocks.repair.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    const first = invoke('repair', event(), deviceId);
    const second = invoke('repair', event(), deviceId);
    await vi.waitFor(() => expect(mocks.repair).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    expect(mocks.repair).toHaveBeenCalledTimes(2);
    mocks.repair.mockRejectedValueOnce(new Error('denied'));
    await expect(invoke('repair', event(), deviceId)).rejects.toThrow('denied');
    await expect(invoke('inspect')).resolves.toBeDefined();
  });
});
