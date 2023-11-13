import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { SortOrder } from '/@common/mediaInfo';

export const tabNames = ['player', 'media', 'scheduler', 'settings'] as const;

export type TabNames = (typeof tabNames)[number];

export type CurrentState = MediaPositionState & {
  tab: TabNames;
  playlist: number | null;
  playbackState?: MediaSessionPlaybackState;
  pip: boolean;
  sortOrder: SortOrder;
  descending: boolean;
  search: string;
  settingsNode: string;
};

export const tabs: Record<TabNames, string> = {
  player: 'Воспроизведение',
  media: 'Медиатека',
  scheduler: 'Планировщик',
  settings: 'Настройки',
};

const initialState: CurrentState = {
  tab: 'player',
  playlist: null,
  // playbackState: 'none',
  pip: false,
  sortOrder: 'uploadTime',
  descending: false,
  search: '',
  settingsNode: '',
};

const currentSlice = createSlice({
  name: 'current',
  initialState,
  reducers: {
    setCurrentTab(state, { payload: tab }: PayloadAction<TabNames>) {
      state.tab = tab;
    },
    setCurrentPlaylist(state, { payload: playlist }: PayloadAction<number | null>) {
      state.playlist = playlist;
    },
    setDuration(state, { payload: duration }: PayloadAction<number | undefined>) {
      state.duration = duration;
    },
    setPosition(state, { payload: position }: PayloadAction<number | undefined>) {
      state.position = position;
    },
    setPlaybackRate(state, { payload: playbackRate }: PayloadAction<number>) {
      state.playbackRate = playbackRate;
    },
    setPlaybackState(state, { payload: playbackState }: PayloadAction<MediaSessionPlaybackState>) {
      state.playbackState = playbackState;
    },
    togglePlaybackState(state) {
      state.playbackState = state.playbackState === 'playing' ? 'paused' : 'playing';
    },
    setPiP(state, { payload: pip }: PayloadAction<boolean>) {
      state.pip = pip;
    },
    setSortOrder(state, { payload: sortOrder }: PayloadAction<SortOrder>) {
      state.sortOrder = sortOrder;
    },
    setDescending(state, { payload: descending }: PayloadAction<boolean>) {
      state.descending = descending;
    },
    setSearch(state, { payload: search }: PayloadAction<string>) {
      state.search = search;
    },
    setSettingsNode(state, { payload: settingsNode }: PayloadAction<string>) {
      state.settingsNode = settingsNode;
    },
    setCurrentPlaylistItem(_, __: PayloadAction<string | undefined>) {
      /**
       * see startAppListening
       */
    },
  },
});

export const {
  setCurrentTab,
  setCurrentPlaylist,
  setPosition,
  setPlaybackState,
  setPlaybackRate,
  setPiP,
  setSortOrder,
  setDescending,
  setSearch,
  togglePlaybackState,
  setSettingsNode,
  setCurrentPlaylistItem,
  setDuration,
} = currentSlice.actions;

export default currentSlice.reducer;
