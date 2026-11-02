import { ipcMain } from 'electron';
import debugFactory from 'debug';
import type { Player } from '/@common/video';
import type { FinitePlaybackPlan } from '/@common/finitePlayback';
import { getPlaylistItems } from './playlist';
import { updatePlayer } from './screen';
import { openPlayer } from './playerWindow';
import { findPlayerWindow } from './windowStore';
import { setPlayerOutputWindowsVisibility } from './openHandler';
import { broadcast } from './server';
import {
  cancelFinitePlayback,
  consumeFinitePlayback,
  registerFinitePlayback,
} from './finitePlaybackRegistry';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:finitePlaylistPlayback`);

export const startFinitePlaylist = async (
  player: Player,
  playlistId: number,
  repeatCount: number,
  completionAction: 'stop' | 'hide',
): Promise<void> => {
  if (
    !Number.isSafeInteger(repeatCount) ||
    repeatCount < 1 ||
    !['stop', 'hide'].includes(completionAction)
  )
    throw new Error('Некорректные параметры конечного воспроизведения');
  const token = crypto.randomUUID();
  let cancelled = false;
  let cleanup = () => {};
  registerFinitePlayback(player.id, {
    token,
    cancel: () => {
      cancelled = true;
      cleanup();
    },
  });
  const check = () => {
    if (cancelled) throw new Error('Конечное воспроизведение отменено');
  };
  try {
    const items = await getPlaylistItems(playlistId);
    check();
    if (!items.length) throw new Error('Плейлист пуст');
    // A process/app restart must not silently turn a finite run into an infinite loop.
    const stoppedPlayer = { ...player, playlistId, current: undefined, autoPlay: false };
    await updatePlayer(stoppedPlayer);
    check();
    const win = findPlayerWindow(player.id) ?? (await openPlayer(player.id, { hidden: true }));
    check();
    if (!win) throw new Error('Не удалось открыть плеер');
    if (win.webContents.isLoadingMainFrame())
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('Плеер не готов'));
        }, 15000);
        const ready = () => {
          cleanup();
          resolve();
        };
        const closed = () => {
          cleanup();
          reject(new Error('Плеер закрыт'));
        };
        const cleanup = () => {
          clearTimeout(timer);
          win.webContents.off('did-finish-load', ready);
          win.webContents.off('destroyed', closed);
        };
        win.webContents.once('did-finish-load', ready);
        win.webContents.once('destroyed', closed);
      });
    check();
    const plan: FinitePlaybackPlan = {
      token,
      playlistId,
      itemIds: items.map(item => item.id),
      repeatCount,
    };
    const sender = win.webContents;
    cleanup = () => {
      ipcMain.off('finite-playback:finished', finished);
      sender.off('destroyed', abandon);
      sender.off('render-process-gone', abandon);
      sender.off('did-start-navigation', navigation);
      if (!sender.isDestroyed()) sender.send('finite-playback:cancel', token);
    };
    const abandon = () => cancelFinitePlayback(player.id);
    const navigation = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => {
      if (mainFrame) abandon();
    };
    const finished = (event: Electron.IpcMainEvent, token: unknown, result: unknown) => {
      if (typeof result !== 'string' || !['complete', 'cancelled', 'error'].includes(result))
        return;
      if (event.sender !== sender || event.senderFrame !== sender.mainFrame || token !== plan.token)
        return;
      if (!consumeFinitePlayback(player.id, plan.token)) return;
      debug(`player ${player.id}: finite playback ${result}`);
      if (result === 'complete' && completionAction === 'hide')
        setPlayerOutputWindowsVisibility(false, player.id);
      broadcast({ event: 'player', all: true });
    };
    ipcMain.on('finite-playback:finished', finished);
    sender.once('destroyed', abandon);
    sender.once('render-process-gone', abandon);
    sender.on('did-start-navigation', navigation);
    sender.send(
      'player',
      { ...stoppedPlayer, autoPlay: true },
      { restart: true, finitePlayback: plan },
    );
    setPlayerOutputWindowsVisibility(true, player.id);
    broadcast({ event: 'player', all: true });
  } catch (error) {
    consumeFinitePlayback(player.id, token);
    throw error;
  }
};
