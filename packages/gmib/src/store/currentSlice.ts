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
import { ipcRenderer } from 'electron';

import { DeviceId, DeviceState, selectDeviceById } from './devicesSlice';
import type { AppThunk, RootState } from './index';

export type TabValues = 'devices' | 'tests' | 'autobrightness';

interface CurrentState {
  tab: TabValues | undefined;
  device: DeviceId | undefined;
  test: string | undefined;
}

const initialState: CurrentState = {
  tab: undefined,
  device: undefined,
  test: undefined,
};

export const currentSlice = createSlice({
  name: 'current',
  initialState,
  reducers: {
    setCurrentTab(state, { payload: tab }: PayloadAction<TabValues | undefined>) {
      state.tab = tab;
    },
    setCurrentDevice(state, { payload: id }: PayloadAction<DeviceId | undefined>) {
      state.device = id;
    },
    setCurrentTest(state, { payload: test }: PayloadAction<string | undefined>) {
      state.test = test;
      test ? ipcRenderer.send('test:show', test) : ipcRenderer.send('test:hide');
    },
  },
});

export const { setCurrentTab, setCurrentDevice, setCurrentTest } = currentSlice.actions;

export const activateDevice = (id: DeviceId | undefined): AppThunk => dispatch => {
  dispatch(setCurrentDevice(id));
  dispatch(setCurrentTab('devices'));
};

export const activateTest = (test: string | undefined): AppThunk => dispatch => {
  dispatch(setCurrentTest(test));
  dispatch(setCurrentTab('tests'));
};

const selectCurrent = (state: RootState): CurrentState => state.current;

export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;

export const selectCurrentDevice = (state: RootState): DeviceState | undefined => {
  const { device } = selectCurrent(state);
  return device !== undefined ? selectDeviceById(state, device) : undefined;
};

export const selectCurrentDeviceId = (state: RootState): DeviceId | undefined =>
  selectCurrent(state).device;

export const selectCurrentTest = (state: RootState): string | undefined =>
  selectCurrent(state).test;

export default currentSlice.reducer;
