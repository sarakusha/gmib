import { setPlayerOutputWindowsVisibility } from './openHandler';
import { revealPlayerOutput } from './outputVisibility';
import { updatePlayerRuntime } from './playerRuntime';
import { openPlayer } from './playerWindow';
import { getPlayer, getPlayers } from './screen';
import { findPlayerWindow } from './windowStore';
import { getLocalPlayerConnection } from './localPlayerConnection';

export const listPluginPlayers = async () =>
  (await getPlayers()).map(({ id, name, autoPlay }) => ({
    id,
    name: name ?? `player#${id}`,
    playing: Boolean(autoPlay),
  }));

export const setPluginPlayerState = async (state: {
  playerId: number;
  playing: boolean;
}): Promise<void> => {
  if (!state || !Number.isSafeInteger(state.playerId) || typeof state.playing !== 'boolean')
    throw new Error('Некорректное состояние плеера');
  const { playerId, playing } = state;
  const player = await getPlayer(playerId);
  if (!player) {
    if (playing) throw new Error(`Плеер ${playerId} не найден`);
    // Cleanup remains safe after the player was removed from the database.
    findPlayerWindow(playerId)?.webContents.send('stop', playerId);
    setPlayerOutputWindowsVisibility(false, playerId);
    return;
  }
  if (playing && !player.playlistId) throw new Error(`У плеера ${playerId} не выбран плейлист`);

  // Reuse the local runtime directly. A new hidden player gets a backend local
  // connection even when no local GMIB UI tab has been registered.
  const needsWindow = playing && !findPlayerWindow(playerId);
  const gmibParams = needsWindow ? getLocalPlayerConnection() : undefined;

  // Persist autoplay before loading the renderer: its initial GET must see the
  // new state even if the IPC update arrives before its listeners are ready.
  await updatePlayerRuntime({
    ...player,
    ...(playing ? {} : { current: undefined }),
    autoPlay: playing,
  });
  if (needsWindow) {
    try {
      const window = await openPlayer(playerId, { hidden: true, gmibParams });
      if (!window) throw new Error(`Не удалось открыть плеер ${playerId}`);
    } catch (error) {
      try {
        await updatePlayerRuntime(player);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Не удалось открыть плеер ${playerId} и восстановить его состояние`,
        );
      }
      throw error;
    }
  }
  if (!playing) findPlayerWindow(playerId)?.webContents.send('stop', playerId);
  if (playing) revealPlayerOutput(playerId);
  setPlayerOutputWindowsVisibility(playing, playerId);
};
