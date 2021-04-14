/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { DeviceId } from '@nibus/core';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState, AppThunk } from './index';

export type TabValues = 'devices' | 'screens' | 'autobrightness' | 'log';

interface CurrentState {
  tab: TabValues | undefined;
  device: DeviceId | undefined;
  screen: string | undefined;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  screen: undefined,
};

const currentSlice = createSlice({
  name: 'current',
  initialState,
  reducers: {
    setCurrentTab(state, { payload: tab }: PayloadAction<TabValues | undefined>) {
      state.tab = tab;
    },
    setCurrentDevice(state, { payload: id }: PayloadAction<DeviceId | undefined>) {
      state.device = id;
    },
    setCurrentScreen(state, { payload: id }: PayloadAction<string | undefined>) {
      state.screen = id;
    },
  },
});

export const { setCurrentDevice, setCurrentTab, setCurrentScreen } = currentSlice.actions;

export const selectCurrent = (state: RootState): CurrentState => state.current;

export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;

export const selectCurrentDeviceId = (state: RootState): DeviceId | undefined =>
  selectCurrent(state).device;

export const activateDevice = (id: DeviceId | undefined): AppThunk => dispatch => {
  dispatch(setCurrentDevice(id));
  dispatch(setCurrentTab('devices'));
};

export const selectCurrentScreenId = (state: RootState): string | undefined =>
  selectCurrent(state).screen;

export default currentSlice.reducer;
