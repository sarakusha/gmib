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
import sortBy from 'lodash/sortBy';
import debounce from 'lodash/debounce';
import SunCalc from 'suncalc';
import config from '../util/config';
import { notEmpty } from '../util/helpers';
import MonotonicCubicSpline, { Point } from '../util/MonotonicCubicSpline';
import type { AsyncInitializer } from './asyncInitialMiddleware';

import {
  DeviceId,
  DeviceState,
  selectDeviceById,
  selectAllDevices,
  setDeviceValue,
} from './devicesSlice';
import type { AppThunk, RootState } from './index';
import { selectLocation } from './locationSlice';
import { selectLastAverage, selectLastIlluminance } from './sensorsSlice';

const BRIGHTNESS_INTERVAL = 60 * 1000;

export type TabValues = 'devices' | 'tests' | 'autobrightness' | 'log';

interface CurrentState {
  tab: TabValues | undefined;
  device: DeviceId | undefined;
  test: string | undefined;
  brightness: number;
  autobrightness: boolean;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  test: undefined,
  brightness: 0,
  autobrightness: false,
};

const saveBrightness = debounce((brightness: number): void => {
  config.set('brightness', brightness);
}, 500);

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
    setBrightness(state, { payload: brightness }: PayloadAction<number>) {
      state.brightness = Math.max(Math.min(brightness, 100), 0);
      saveBrightness(state.brightness);
    },
    setAutobrightness(state, { payload: on }: PayloadAction<boolean>) {
      state.autobrightness = on;
      config.set('autobrightness', on);
      ipcRenderer.send('autoStart', on);
    },
  },
});

export const {
  setCurrentTab,
  setCurrentDevice,
  setCurrentTest,
  // setCurrentBrightness,
  setAutobrightness,
} = currentSlice.actions;

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

export const selectCurrentBrightness = (state: RootState): number =>
  selectCurrent(state).brightness;

export const selectAutobrightness = (state: RootState): boolean =>
  selectCurrent(state).autobrightness;

const updateBrightness = debounce<AppThunk>((dispatch, getState) => {
  const brightness = selectCurrentBrightness(getState());
  if (brightness === undefined) return;
  const devices = selectAllDevices(getState()).filter(({ mib }) => mib.startsWith('minihost'));
  devices.forEach(({ id }) => dispatch(setDeviceValue(id)('brightness', brightness)));
}, 500);

export const setCurrentBrightness = (value: number): AppThunk => (dispatch, getState) => {
  dispatch(currentSlice.actions.setBrightness(value));
  dispatch(updateBrightness);
};

const calculateBrightness: AppThunk = (dispatch, getState) => {
  const data = config.get('spline');
  const state = getState();
  const illuminance = selectLastAverage(state, 'illuminance');
  // console.log({ illuminance });
  let brightness = selectCurrentBrightness(state);
  const autobrightness = selectAutobrightness(state);
  const { latitude, longitude, error } = selectLocation(state);
  const isValidLocation = latitude !== undefined && longitude !== undefined && error === undefined;
  if (autobrightness && data) {
    const safeData = sortBy(data.filter(notEmpty), ([lux]) => lux);
    const [min] = safeData;
    const max = safeData[safeData.length - 1];
    const [minLux, minBrightness] = min;
    const [maxLux, maxBrightness] = max;
    if (illuminance !== undefined) {
      // На показаниях датчика
      const illuminanceSpline = new MonotonicCubicSpline(
        safeData.map<Point>(([lux, bright]) => [Math.log(1 + lux), bright])
      );
      if (illuminance <= minLux) brightness = minBrightness;
      else if (illuminance >= maxLux) brightness = maxBrightness;
      else brightness = Math.round(illuminanceSpline.interpolate(Math.log(1 + illuminance)));
    } else if (isValidLocation) {
      // По высоте солнца
      // Полдень = 1, Начало вечера/Конец утра = 3/4, Заход/Восход = 1/2, ночь = 0
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const getTime = (date: Date): number => date.getTime() - midnight.getTime();
      const getBrightness = (aspect: number): number =>
        minBrightness + (maxBrightness - minBrightness) * aspect;
      const {
        nadir,
        sunriseEnd,
        goldenHourEnd,
        solarNoon,
        goldenHour,
        sunsetStart,
        night,
      } = SunCalc.getTimes(now, latitude!, longitude!);
      const sunSpline =
        now <= solarNoon
          ? new MonotonicCubicSpline([
              [getTime(nadir), getBrightness(0)],
              [getTime(sunriseEnd), getBrightness(1 / 2)],
              [getTime(goldenHourEnd), getBrightness(3 / 4)],
              [getTime(solarNoon), getBrightness(1)],
            ])
          : new MonotonicCubicSpline([
              [getTime(solarNoon), getBrightness(1)],
              [getTime(goldenHour), getBrightness(3 / 4)],
              [getTime(sunsetStart), getBrightness(1 / 2)],
              [getTime(night), getBrightness(0)],
            ]);
      brightness = Math.round(sunSpline.interpolate(getTime(now)));
    }
  }
  dispatch(setCurrentBrightness(brightness));
};

// export const setAutobrightness = (on: boolean): AppThunk => dispatch => {
//   dispatch(currentSlice.actions.setAutobrightness(on));
// };

let brightnessTimer = 0;

// Используем инициализатор, не initialState, чтобы запустить действия из AppThunk!
export const initializeCurrent: AsyncInitializer = dispatch => {
  dispatch(setCurrentBrightness(config.get('brightness')));
  dispatch(setAutobrightness(config.get('autobrightness')));
  if (!brightnessTimer) {
    brightnessTimer = window.setInterval(() => dispatch(calculateBrightness), BRIGHTNESS_INTERVAL);
  }
};

export default currentSlice.reducer;
