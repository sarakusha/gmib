import type { Player } from '/@common/video';

export const getBackgroundAutoplayPlayers = (
  players: Player[],
  restoredPlayerIds: readonly number[] = [],
): Player[] => {
  const restored = new Set(restoredPlayerIds);
  return players.filter(
    player => !restored.has(player.id) && Boolean(player.playlistId) && player.autoPlay,
  );
};
