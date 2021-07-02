/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Health } from '../util/localConfig';
import { addScreen, removeScreen, showHttpPage, updateConfig } from './configSlice';
import { addDevice, DeviceState, removeDevice, selectDeviceById } from './devicesSlice';
import type { AppThunk, RootState } from './index';
import { addNovastar, removeNovastar } from './novastarsSlice';

export type TabValues = 'devices' | 'screens' | 'autobrightness' | 'overheat' | 'log';

interface CurrentState {
  tab: TabValues | undefined;
  device: string | undefined;
  screen: string | undefined;
  health: Health | undefined;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  screen: undefined,
  health: undefined,
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
    setCurrentScreen(state, { payload: id }: PayloadAction<string | undefined>) {
      state.screen = id;
    },
    setCurrentHealth(state, { payload: health }: PayloadAction<Health | undefined>) {
      state.health = health;
    },
  },
  extraReducers: builder => {
    builder.addCase(addDevice, (state, { payload: id }) => {
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
    builder.addCase(updateConfig, (state, { payload: { screens } }) => {
      if (screens.length === 0) {
        state.screen = undefined;
      } else if (!state.screen || !screens.map(({ id }) => id).includes(state.screen)) {
        state.screen = screens[0].id;
      }
    });
  },
});

export const {
  setCurrentDevice,
  setCurrentTab,
  setCurrentScreen,
  setCurrentHealth,
} = currentSlice.actions;

export const selectCurrent = (state: RootState): CurrentState => state.current;

export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;

export const selectCurrentDeviceId = (state: RootState): string | undefined =>
  selectCurrent(state).device;

export const activateDevice = (id: string | undefined): AppThunk => dispatch => {
  dispatch(setCurrentDevice(id));
  dispatch(setCurrentTab('devices'));
};

export const selectCurrentScreenId = (state: RootState): string | undefined =>
  selectCurrent(state).screen;

export const selectCurrentDevice = (state: RootState): DeviceState | undefined => {
  const device = selectCurrentDeviceId(state);
  return device !== undefined ? selectDeviceById(state, device) : undefined;
};

export const selectCurrentHealth = (state: RootState): Health | undefined =>
  selectCurrent(state).health;

export default currentSlice.reducer;
