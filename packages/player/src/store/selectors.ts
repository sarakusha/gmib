import type { SortOrder } from '../components/MediaTabToolbar';

import type { CurrentState } from './currentSlice';
// import type { PlayerState } from './playerSlice';

import type { RootState } from './index';

// export const selectPlayerSate = (state: RootState): PlayerState => state.player;

// export const selectPlayerId = (state: RootState): number => selectPlayerSate(state).id;

export const selectCurrent = (state: RootState): CurrentState => state.current;

export const selectCurrentTab = (state: RootState): string => selectCurrent(state).tab;

export const selectCurrentPlaylist = (state: RootState): number | null =>
  selectCurrent(state).playlist;

export const selectPosition = (state: RootState): number | undefined =>
  selectCurrent(state).position;

export const selectDuration = (state: RootState): number | undefined =>
  selectCurrent(state).duration;

export const selectPlaybackRate = (state: RootState): number | undefined =>
  selectCurrent(state).playbackRate;

export const selectPiP = (state: RootState): boolean => selectCurrent(state).pip;

export const selectPlaybackState = (state: RootState): MediaSessionPlaybackState =>
  selectCurrent(state).playbackState ?? 'none';

export const selectSortOrder = (state: RootState): SortOrder => selectCurrent(state).sortOrder;
export const selectDescending = (state: RootState): boolean => selectCurrent(state).descending;
export const selectSearch = (state: RootState): string => selectCurrent(state).search;
export const selectSettingsNode = (state: RootState): string => selectCurrent(state).settingsNode;
