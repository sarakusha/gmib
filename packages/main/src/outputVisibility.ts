import { getPlaybackOutputPlayerIds, invalidatePlaybackOutputs } from './playbackOutputState';

let hidden = false;
let playersHidden = false;
const playerOverrides = new Map<number, boolean>();
const screenOverrides = new Map<number, boolean>();
const explicitPlayerShows = new Set<number>();

export const isScreenOutputHidden = (screenId: number): boolean =>
  screenOverrides.get(screenId) ?? hidden;
export const setScreenOutputHidden = (screenId: number, value: boolean): void => {
  screenOverrides.set(screenId, value);
};
export const clearScreenOutputVisibility = (screenId: number): void => {
  screenOverrides.delete(screenId);
};
// A plugin's explicit show affects only its selected player. The next global
// hide/show command takes priority again and clears these one-off overrides.
export const revealPlayerOutput = (playerId: number): void => {
  explicitPlayerShows.add(playerId);
  invalidatePlaybackOutputs(playerId, 'unknown');
};

export const isOutputHidden = (): boolean => hidden;

export const setOutputHidden = (value: boolean): boolean => {
  const previous = new Map(getPlaybackOutputPlayerIds().map(id => [id, isPlayerOutputHidden(id)]));
  hidden = value;
  screenOverrides.clear();
  explicitPlayerShows.clear();
  previous.forEach((wasHidden, id) => {
    const nowHidden = isPlayerOutputHidden(id);
    if (wasHidden !== nowHidden) invalidatePlaybackOutputs(id, nowHidden ? 'hidden' : 'unknown');
  });
  return hidden;
};

// Global hiding and a player's own intent are independent gates. Neither recovery nor
// a global reveal should undo a scheduler/manual hide for a particular player.
export const isPlayerOutputHidden = (playerId: number): boolean =>
  !explicitPlayerShows.has(playerId) &&
  (hidden || (playerOverrides.get(playerId) ?? playersHidden));

export const setPlayerOutputHidden = (value: boolean, playerId?: number): void => {
  const ids = playerId == null ? getPlaybackOutputPlayerIds() : [playerId];
  const previous = new Map(ids.map(id => [id, isPlayerOutputHidden(id)]));
  if (playerId == null) {
    explicitPlayerShows.clear();
    playersHidden = value;
    playerOverrides.clear();
  } else {
    if (value) explicitPlayerShows.delete(playerId);
    playerOverrides.set(playerId, value);
  }
  previous.forEach((wasHidden, id) => {
    const nowHidden = isPlayerOutputHidden(id);
    if (wasHidden !== nowHidden) invalidatePlaybackOutputs(id, nowHidden ? 'hidden' : 'unknown');
  });
};
