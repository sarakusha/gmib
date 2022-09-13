import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Health } from '/@common/helpers';

// import { addScreen, removeScreen, showHttpPage } from './configSlice';
import { addDevice, removeDevice } from './devicesSlice';
import { addNovastar, removeNovastar } from './novastarsSlice';

export type TabValues = 'devices' | 'screens' | 'autobrightness' | 'overheat' | 'log';
// | 'media'
// | 'playlist'
// | 'scheduler';

export interface CurrentState {
  tab: TabValues | undefined;
  device: string | undefined;
  screen: number | undefined;
  health: Health | undefined;
  isRemoteDialogOpen: boolean;
  // playlist: number | undefined;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  screen: undefined,
  health: undefined,
  isRemoteDialogOpen: false,
  // playlist: undefined,
};

const currentSlice = createSlice({
  name: 'current',
  initialState,
  reducers: {
    setCurrentTab(state, { payload: tab }: PayloadAction<TabValues | undefined>) {
      state.tab = tab;
    },
    setCurrentDevice(state, { payload: id }: PayloadAction<string | undefined>) {
      state.device = id;
    },
    setCurrentScreen(state, { payload: id }: PayloadAction<number | undefined>) {
      state.screen = id;
    },
    setCurrentHealth(state, { payload: health }: PayloadAction<Health | undefined>) {
      state.health = health;
    },
    setRemoteDialogOpen(state, { payload: open }: PayloadAction<boolean>) {
      state.isRemoteDialogOpen = open;
    },
    // setCurrentPlaylist(state, { payload: id }: PayloadAction<number| undefined>) {
    //   state.playlist = id;
    // },
  },
  extraReducers: builder => {
    builder.addCase(addDevice, (state, { payload: { id } }) => {
      if (!state.device) {
        state.device = id;
      }
    });
    builder.addCase(removeDevice, (state, { payload: id }) => {
      if (state.device === id) {
        state.device = undefined;
      }
    });
    builder.addCase(addNovastar, (state, { payload: { path } }) => {
      if (!state.device) {
        state.device = path;
      }
    });
    builder.addCase(removeNovastar, (state, { payload: path }) => {
      if (state.device === path) {
        state.device = undefined;
      }
    });
    /*
    builder.addCase(showHttpPage, state => {
      state.tab = 'screens';
    });
    builder.addCase(addScreen, (state, { payload: [id] }) => {
      state.screen = id;
    });
    builder.addCase(removeScreen, (state, { payload: id }) => {
      if (state.screen === id) {
        state.screen = undefined;
      }
    });
*/
    /*
    builder.addCase(updateConfig, (state, { payload: { screens } }) => {
      if (!screens || screens.length === 0) {
        state.screen = undefined;
      } else if (!state.screen || !screens.map(({ id }) => id).includes(state.screen)) {
        state.screen = screens[0].id;
      }
    });
*/
  },
});

export const {
  setCurrentDevice,
  setCurrentTab,
  setCurrentScreen,
  setCurrentHealth,
  setRemoteDialogOpen,
  // setCurrentPlaylist,
} = currentSlice.actions;

export default currentSlice.reducer;
