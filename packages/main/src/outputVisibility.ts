let hidden = false;
let playersHidden = false;
const playerOverrides = new Map<number, boolean>();

export const isOutputHidden = (): boolean => hidden;

export const setOutputHidden = (value: boolean): boolean => {
  hidden = value;
  return hidden;
};

// Global hiding and a player's own intent are independent gates. Neither recovery nor
// a global reveal should undo a scheduler/manual hide for a particular player.
export const isPlayerOutputHidden = (playerId: number): boolean =>
  hidden || (playerOverrides.get(playerId) ?? playersHidden);

export const setPlayerOutputHidden = (value: boolean, playerId?: number): void => {
  if (playerId == null) {
    playersHidden = value;
    playerOverrides.clear();
  } else {
    playerOverrides.set(playerId, value);
  }
};
