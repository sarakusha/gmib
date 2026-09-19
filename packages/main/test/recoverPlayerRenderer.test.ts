import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getAllWebContents: vi.fn() }));
vi.mock('electron', () => ({ webContents: mocks }));

import type { ManagedWindow } from '../src/managedWindow';
import { recoverPlayerRenderer } from '../src/recoverPlayerRenderer';

const contents = (id: number, processId: number) => ({
  id,
  getOSProcessId: vi.fn(() => processId),
  isDestroyed: vi.fn(() => false),
  forcefullyCrashRenderer: vi.fn(),
});

const setup = () => {
  const target = contents(1, 42);
  const window = {
    webContents: target,
    isDestroyed: vi.fn(() => false),
    loadURL: vi.fn().mockResolvedValue(undefined),
  };
  mocks.getAllWebContents.mockReturnValue([target]);
  return { target, window, managed: window as unknown as ManagedWindow };
};

beforeEach(() => vi.resetAllMocks());

describe('recoverPlayerRenderer', () => {
  it('navigates a responsive player without killing its renderer', async () => {
    const { managed, target, window } = setup();
    await recoverPlayerRenderer(managed, 'http://localhost/player.html', false);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(window.loadURL).toHaveBeenCalledWith('http://localhost/player.html');
  });

  it('kills only an exclusive unresponsive renderer before navigation', async () => {
    const { managed, target, window } = setup();
    mocks.getAllWebContents.mockReturnValue([target, contents(2, 43)]);
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).toHaveBeenCalledOnce();
    expect(target.forcefullyCrashRenderer.mock.invocationCallOrder[0]).toBeLessThan(
      window.loadURL.mock.invocationCallOrder[0],
    );
  });

  it('preserves every other page sharing the process', async () => {
    const { managed, target, window } = setup();
    mocks.getAllWebContents.mockReturnValue([target, contents(2, 42)]);
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(window.loadURL).toHaveBeenCalledOnce();
  });

  it.each([0, -1, NaN])('does not kill when the target process ID is %s', async processId => {
    const { managed, target } = setup();
    target.getOSProcessId.mockReturnValue(processId);
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
  });

  it('falls back to navigation when the process inventory fails', async () => {
    const { managed, target, window } = setup();
    mocks.getAllWebContents.mockImplementation(() => {
      throw new Error('Renderer destroyed');
    });
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(window.loadURL).toHaveBeenCalledOnce();
  });

  it('does not kill a target absent from the process inventory', async () => {
    const { managed, target, window } = setup();
    mocks.getAllWebContents.mockReturnValue([]);
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(window.loadURL).toHaveBeenCalledOnce();
  });

  it('navigates if forceful termination fails', async () => {
    const { managed, target, window } = setup();
    target.forcefullyCrashRenderer.mockImplementation(() => {
      throw new Error('Process exited');
    });
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(window.loadURL).toHaveBeenCalledOnce();
  });

  it('does nothing after the managed window is destroyed', async () => {
    const { managed, target, window } = setup();
    window.isDestroyed.mockReturnValue(true);
    await recoverPlayerRenderer(managed, 'player-url', true);
    expect(target.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(window.loadURL).not.toHaveBeenCalled();
  });

  it('propagates navigation failures to the supervisor for diagnostics', async () => {
    const { managed, window } = setup();
    window.loadURL.mockRejectedValue(new Error('Navigation failed'));
    await expect(recoverPlayerRenderer(managed, 'player-url', false)).rejects.toThrow(
      'Navigation failed',
    );
  });
});
