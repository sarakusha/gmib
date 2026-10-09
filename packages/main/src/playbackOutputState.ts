import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';

type Listener = (playerId: number, outputs: PlaybackOutputSnapshot[], at: number) => void;
const snapshots = new Map<number, PlaybackOutputSnapshot[]>();
const listeners = new Set<Listener>();
const invalidationListeners = new Set<(playerId?: number) => void>();
export const onPlaybackOutputsInvalidated = (
  listener: (playerId?: number) => void,
): (() => void) => {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
};
export const getPlaybackOutputPlayerIds = (): number[] => [...snapshots.keys()];
export const getPlaybackOutputs = (playerId: number): PlaybackOutputSnapshot[] =>
  snapshots.get(playerId) ?? [];
export const setPlaybackOutputs = (playerId: number, outputs: PlaybackOutputSnapshot[]): void => {
  if (JSON.stringify(snapshots.get(playerId)) === JSON.stringify(outputs)) return;
  snapshots.set(playerId, outputs);
  listeners.forEach(listener => listener(playerId, outputs, Date.now()));
};
export const onPlaybackOutputsChanged = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
/** Invalidate reusable evidence before the next health reply after a native change. */
export const invalidatePlaybackOutputs = (
  playerId?: number,
  state: 'hidden' | 'unknown' = 'unknown',
): void => {
  invalidationListeners.forEach(listener => listener(playerId));
  const ids = playerId === undefined ? [...snapshots.keys()] : [playerId];
  ids.forEach(id =>
    setPlaybackOutputs(
      id,
      getPlaybackOutputs(id).map(output => ({ ...output, state })),
    ),
  );
};
export const forgetPlaybackOutputs = (playerId: number): void => {
  invalidatePlaybackOutputs(playerId);
  snapshots.delete(playerId);
};
