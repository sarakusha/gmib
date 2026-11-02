type Run = { token: string; cancel: () => void };
const runs = new Map<number, Run>();
export const cancelFinitePlayback = (playerId: number): void => {
  const run = runs.get(playerId);
  runs.delete(playerId);
  run?.cancel();
};
export const registerFinitePlayback = (playerId: number, run: Run): void => {
  cancelFinitePlayback(playerId);
  runs.set(playerId, run);
};
export const consumeFinitePlayback = (playerId: number, token: string): boolean => {
  if (runs.get(playerId)?.token !== token) return false;
  const run = runs.get(playerId)!;
  runs.delete(playerId);
  run.cancel();
  return true;
};

export const isFinitePlaybackActive = (playerId: number): boolean => runs.has(playerId);
