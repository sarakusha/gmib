import type { Player } from '/@common/video';

import { openPlayer } from './playerWindow';
import { getPlayer, updatePlayer } from './screen';
import { broadcast } from './server';
import { findPlayerWindow } from './windowStore';

type PlayerRuntimeOptions = {
  openHidden?: boolean;
  restart?: boolean;
};

const sendPlayerToRuntime = async (
  playerId: number,
  options: Pick<PlayerRuntimeOptions, 'restart'> = {},
): Promise<Player | undefined> => {
  const player = await getPlayer(playerId);
  if (!player) return undefined;
  const win = findPlayerWindow(player.id);
  if (win) win.webContents.send('player', player, { restart: options.restart });
  broadcast({ event: 'player', all: true });
  return player;
};

export const updatePlayerRuntime = async (
  player: Player,
  options: PlayerRuntimeOptions = {},
): Promise<void> => {
  await updatePlayer(player);
  const updatedPlayer = await sendPlayerToRuntime(player.id, options);
  if (options.openHidden && !findPlayerWindow(player.id) && updatedPlayer) {
    await openPlayer(player.id, { hidden: true });
  }
};
