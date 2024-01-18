import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Health } from '/@common/helpers';

// import { addScreen, removeScreen, showHttpPage } from './configSlice';
import { addDevice } from './devicesSlice';
// import { addNovastar, removeNovastar } from './novastarSlice';

export type TabValues = 'devices' | 'screens' | 'autobrightness' | 'overheat' | 'log' | 'help';
// | 'media'
// | 'playlist'
// | 'scheduler';

type Credentials = {
  identifier: string;
  host?: string;
};
export interface CurrentState {
  tab: TabValues | undefined;
  device: string | undefined;
  screen: number | undefined;
  health: Health | undefined;
  isRemoteDialogOpen: boolean;
  authRequired?: Credentials;
  broadcastDetected?: string;
  isActivateDialogOpen: boolean;
  invalidState: boolean;
  focused: boolean;
  tabChangedTimestamp?: number;
  // playlist: number | undefined;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  screen: undefined,
  health: undefined,
  isRemoteDialogOpen: false,
  isActivateDialogOpen: false,
  invalidState: false,
  focused: true,
  // isLoggedIn: true, // isRemoteSession ? !!window.identify.getSecret() : true,
  // playlist: undefined,
};

const currentSlice = createSlice({
  name: 'current',
  initialState,
  reducers: {
    setCurrentTab(state, { payload: tab }: PayloadAction<TabValues | undefined>) {
      if (state.tab !== tab) {
        state.tab = tab;
        state.tabChangedTimestamp = Date.now();
      }
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
    setActivateDialogOpen(state, { payload: open }: PayloadAction<boolean>) {
      state.isActivateDialogOpen = open;
    },
    // setLoggedIn(state, { payload: isLoggedIn }: PayloadAction<boolean>) {
    //   state.isLoggedIn = isLoggedIn;
    // },
    setAuthRequired(state, { payload: credentials }: PayloadAction<Credentials | undefined>) {
      state.authRequired = credentials;
    },
    // setCurrentPlaylist(state, { payload: id }: PayloadAction<number| undefined>) {
    //   state.playlist = id;
    // },
    setBroadcastDetected(state, { payload: address }: PayloadAction<string | undefined>) {
      if (!address) {
        state.broadcastDetected = undefined;
      } else if (state.broadcastDetected) {
        if (state.broadcastDetected.split(', ').every(item => item !== address))
          state.broadcastDetected += `, ${address}`;
      } else {
        state.broadcastDetected = address;
      }
    },
    setInvalidState(state, { payload: invalid }: PayloadAction<boolean>) {
      state.invalidState = invalid;
    },
    setFocused(state, { payload: focused }: PayloadAction<boolean>) {
      state.focused = focused;
    },
  },
  extraReducers: builder => {
    builder.addCase(addDevice, (state, { payload: { id } }) => {
      if (!state.device) {
        state.device = id;
      }
    });
    // builder.addCase(removeDevice, (state, { payload: id }) => {
    //   if (state.device === id) {
    //     state.device = undefined;
    //   }
    // });
    // builder.addCase(addNovastar, (state, { payload: { path } }) => {
    //   if (!state.device) {
    //     state.device = path;
    //   }
    // });
    // builder.addCase(removeNovastar, (state, { payload: path }) => {
    //   if (state.device === path) {
    //     state.device = undefined;
    //   }
    // });
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
  setActivateDialogOpen,
  // setCurrentPlaylist,
  // setLoggedIn,
  setAuthRequired,
  setBroadcastDetected,
  setInvalidState,
  setFocused,
} = currentSlice.actions;

export default currentSlice;
