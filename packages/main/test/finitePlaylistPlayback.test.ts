import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '/@common/video';

const mock = vi.hoisted(() => ({
  items: vi.fn(),
  update: vi.fn(),
  open: vi.fn(),
  find: vi.fn(),
  visibility: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return { ipcMain: new EventEmitter() };
});
vi.mock('../src/playlist', () => ({ getPlaylistItems: mock.items }));
vi.mock('../src/screen', () => ({ updatePlayer: mock.update }));
vi.mock('../src/playerWindow', () => ({ openPlayer: mock.open }));
vi.mock('../src/windowStore', () => ({ findPlayerWindow: mock.find }));
vi.mock('../src/openHandler', () => ({ setPlayerOutputWindowsVisibility: mock.visibility }));
vi.mock('../src/server', () => ({ broadcast: mock.broadcast }));
import { ipcMain } from 'electron';
import { startFinitePlaylist } from '../src/finitePlaylistPlayback';
import { cancelFinitePlayback, isFinitePlaybackActive } from '../src/finitePlaybackRegistry';
const player = { id: 1, name: 'Test', autoPlay: true } as Player;
let sender: EventEmitter & {
  send: ReturnType<typeof vi.fn>;
  mainFrame: object;
  isDestroyed: () => boolean;
  isLoadingMainFrame: () => boolean;
};
beforeEach(() => {
  cancelFinitePlayback(1);
  vi.clearAllMocks();
  ipcMain.removeAllListeners();
  sender = Object.assign(new EventEmitter(), {
    send: vi.fn(),
    mainFrame: {},
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
  });
  mock.find.mockReturnValue({ webContents: sender });
  mock.items.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
  mock.update.mockResolvedValue({ changes: 1 });
});
const token = () =>
  sender.send.mock.calls.find(([name]) => name === 'player')![2].finitePlayback.token as string;
const finish = (result: unknown, value = token(), frame = sender.mainFrame) =>
  ipcMain.emit('finite-playback:finished', { sender, senderFrame: frame }, value, result);
describe('finite playlist main lifecycle', () => {
  it('persists stopped state, sends transient playing plan, hides once on completion', async () => {
    await startFinitePlaylist(player, 2, 3, 'hide');
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ autoPlay: false, playlistId: 2 }),
    );
    expect(sender.send).toHaveBeenCalledWith(
      'player',
      expect.objectContaining({ autoPlay: true }),
      expect.objectContaining({
        finitePlayback: expect.objectContaining({ repeatCount: 3, itemIds: ['a', 'b'] }),
      }),
    );
    const run = token();
    finish('complete', 'stale');
    finish('complete', run, {});
    finish(['complete'], run);
    expect(isFinitePlaybackActive(1)).toBe(true);
    finish('complete', run);
    finish('complete', run);
    expect(isFinitePlaybackActive(1)).toBe(false);
    expect(mock.visibility.mock.calls).toEqual([
      [true, 1],
      [false, 1],
    ]);
  });
  it('stop completion and error leave the black output visible', async () => {
    await startFinitePlaylist(player, 2, 1, 'stop');
    finish('complete');
    expect(mock.visibility.mock.calls).toEqual([[true, 1]]);
    await startFinitePlaylist(player, 2, 1, 'hide');
    finish('error');
    expect(mock.visibility.mock.calls).toEqual([
      [true, 1],
      [true, 1],
    ]);
  });
  it('cancellation while playlist metadata loads cannot resume playback', async () => {
    let resolve!: (items: { id: string }[]) => void;
    mock.items.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );
    const starting = startFinitePlaylist(player, 2, 1, 'hide');
    cancelFinitePlayback(1);
    resolve([{ id: 'a' }]);
    await expect(starting).rejects.toThrow('отменено');
    expect(mock.update).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('renderer crash consumes the run without hiding output', async () => {
    await startFinitePlaylist(player, 2, 1, 'hide');
    sender.emit('render-process-gone');
    expect(isFinitePlaybackActive(1)).toBe(false);
    expect(mock.visibility.mock.calls).toEqual([[true, 1]]);
  });
  it('rejects invalid counts and empty playlists before enabling playback', async () => {
    await expect(startFinitePlaylist(player, 2, 1.5, 'stop')).rejects.toThrow();
    mock.items.mockResolvedValue([]);
    await expect(startFinitePlaylist(player, 2, 1, 'stop')).rejects.toThrow('пуст');
    expect(mock.update).not.toHaveBeenCalled();
    expect(isFinitePlaybackActive(1)).toBe(false);
  });
});
