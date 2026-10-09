import { getPlaybackOutputPlayerIds, invalidatePlaybackOutputs } from './playbackOutputState';

let hidden = false;
let playersHidden = false;
const playerOverrides = new Map<number, boolean>();

export const isOutputHidden = (): boolean => hidden;

export const setOutputHidden = (value: boolean): boolean => {
  const previous = new Map(getPlaybackOutputPlayerIds().map(id => [id, isPlayerOutputHidden(id)]));
  hidden = value;
  previous.forEach((wasHidden, id) => {
    const nowHidden = isPlayerOutputHidden(id);
    if (wasHidden !== nowHidden) invalidatePlaybackOutputs(id, nowHidden ? 'hidden' : 'unknown');
  });
  return hidden;
};

// Global hiding and a player's own intent are independent gates. Neither recovery nor
// a global reveal should undo a scheduler/manual hide for a particular player.
export const isPlayerOutputHidden = (playerId: number): boolean =>
  hidden || (playerOverrides.get(playerId) ?? playersHidden);

export const setPlayerOutputHidden = (value: boolean, playerId?: number): void => {
  const ids = playerId == null ? getPlaybackOutputPlayerIds() : [playerId];
  const previous = new Map(ids.map(id => [id, isPlayerOutputHidden(id)]));
  if (playerId == null) {
    playersHidden = value;
    playerOverrides.clear();
  } else {
    playerOverrides.set(playerId, value);
  }
  previous.forEach((wasHidden, id) => {
    const nowHidden = isPlayerOutputHidden(id);
    if (wasHidden !== nowHidden) invalidatePlaybackOutputs(id, nowHidden ? 'hidden' : 'unknown');
  });
};
