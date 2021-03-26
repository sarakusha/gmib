/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Address, DeviceId, LogLevel } from '@nibus/core';
import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import debounce from 'lodash/debounce';
import type { DebouncedFunc } from 'lodash';
import sortBy from 'lodash/sortBy';
import SunCalc from 'suncalc';
import Ajv from 'ajv';
import { configSchema, Config, Location, Screen, Page } from '../util/config';
import { getSession, notEmpty, PropPayloadAction } from '../util/helpers';
import MonotonicCubicSpline, { Point } from '../util/MonotonicCubicSpline';
import type { AsyncInitializer } from './asyncInitialMiddleware';
import type { AppThunk, RootState } from './index';
import { selectLastAverage } from './sensorsSlice';
import type { SessionId } from './sessionsSlice';
import debugFactory from '../util/debug';

const debug = debugFactory('gmib:currentSlice');

// cyclic dependency
const devicesSlice = import('./devicesSlice');
const sessionSlice = import('./sessionsSlice');

const BRIGHTNESS_INTERVAL = 60 * 1000;

const ajv = new Ajv({ removeAdditional: 'failing' });

export type TabValues = 'devices' | 'tests' | 'autobrightness' | 'log';

const params = new URLSearchParams(window.location.search);

interface CurrentState extends Config {
  tab: TabValues | undefined;
  device: DeviceId | undefined;
  session: SessionId;
}

const initialState: CurrentState = {
  tab: 'devices',
  device: undefined,
  test: undefined,
  brightness: 30,
  autobrightness: false,
  spline: undefined,
  // session: '192.168.23.26:9001',
  session: `${params.get('host') || ''}:${params.get('port') || 9001}` as SessionId,
  screen: {
    width: 640,
    height: 320,
    moduleHres: 40,
    moduleVres: 40,
    x: 0,
    y: 0,
    display: true,
  },
  logLevel: 'none',
  tests: [],
};

export type RemoteSession = { id: SessionId; isPersist: boolean };

const savers: Record<string, DebouncedFunc<(config: Config) => void>> = {};
const validateConfig = ajv.compile({
  type: 'object',
  additionalProperties: false,
  properties: configSchema,
});

const saveConfig = (state: CurrentState): void => {
  const { session: id } = state;
  let save = savers[id];
  if (!save) {
    save = debounce((config: Config): void => {
      const session = getSession(id);
      if (!session) {
        console.error(`Unknown session ${id}`);
        return;
      }
      const data = { ...config };
      if (!validateConfig(data)) console.warn(`error while validate config`);
      session.saveConfig(data);
    }, 500);
    savers[id] = save;
  }
  save(state);
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
      saveConfig(current(state));
    },
    setBrightness(state, { payload: brightness }: PayloadAction<number>) {
      state.brightness = Math.round(Math.max(Math.min(brightness, 100), 0));
      saveConfig(current(state));
    },
    setAutobrightness(state, { payload: on }: PayloadAction<boolean>) {
      state.autobrightness = on;
      saveConfig(current(state));
    },
    updateCurrentSession(state, { payload: id }: PayloadAction<SessionId>) {
      if (id === state.session) return;
      const save = savers[state.session];
      state.session = id;
      save && save.flush();
    },
    setSpline(state, { payload: spline }: PayloadAction<Config['spline']>) {
      state.spline = spline;
      saveConfig(current(state));
    },
    setLocationProp(state, { payload: [prop, value] }: PropPayloadAction<Location>) {
      if (!state.location) state.location = {};
      state.location[prop] = value;
      saveConfig(current(state));
    },
    setScreenProp(state, { payload: [prop, value] }: PropPayloadAction<Screen>) {
      state.screen[prop] = value as never;
      saveConfig(current(state));
    },
    loadConfig(state, { payload: config }: PayloadAction<Config>) {
      Object.assign(state, config);
    },
    setLogLevel(state, { payload: logLevel }: PayloadAction<LogLevel>) {
      const session = getSession(state.session);
      state.logLevel = logLevel;
      session.setLogLevel(logLevel);
      saveConfig(current(state));
    },
    upsertHttpPage(state, { payload: page }: PayloadAction<Page>) {
      const found = state.tests.find(({ id }) => id === page.id);
      if (found) {
        Object.assign(found, page);
      } else {
        state.tests.push(page);
      }
      saveConfig(current(state));
    },
    removeHttpPage(state, { payload: id }: PayloadAction<string>) {
      state.tests = state.tests.filter(page => page.id !== id);
      saveConfig(current(state));
    },
  },
});

export const selectCurrent = (state: RootState): CurrentState => state.current;

export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;

export const selectCurrentDeviceId = (state: RootState): DeviceId | undefined =>
  selectCurrent(state).device;

export const selectCurrentTest = (state: RootState): string | undefined =>
  selectCurrent(state).test;

export const selectCurrentBrightness = (state: RootState): number =>
  selectCurrent(state).brightness;

export const selectAutobrightness = (state: RootState): boolean =>
  selectCurrent(state).autobrightness;

export const selectCurrentSession = (state: RootState): SessionId => selectCurrent(state).session;

export const selectCurrentSpline = (state: RootState): Config['spline'] =>
  selectCurrent(state).spline;

export const selectCurrentLocation = (state: RootState): Config['location'] =>
  selectCurrent(state).location;

export const selectScreen = (state: RootState): Screen => selectCurrent(state).screen;

export const selectLogLevel = (state: RootState): LogLevel => selectCurrent(state).logLevel;

export const selectAllTests = (state: RootState): Page[] => selectCurrent(state).tests;

export const selectTestById = (state: RootState, id: string): Page | undefined =>
  selectAllTests(state).find(test => test.id === id);

export const {
  setCurrentTab,
  setCurrentDevice,
  setCurrentTest,
  updateCurrentSession,
  setAutobrightness,
  setSpline,
  // setLongitude,
  // setLatitude,
  setLocationProp,
  setScreenProp,
  setLogLevel,
  upsertHttpPage,
  removeHttpPage,
} = currentSlice.actions;

export const activateDevice = (id: DeviceId | undefined): AppThunk => dispatch => {
  dispatch(setCurrentDevice(id));
  dispatch(setCurrentTab('devices'));
};

export const initializeMinihosts = (deviceId?: DeviceId): AppThunk => (dispatch, getState) => {
  const state = getState();
  const { address, width, height, x, y, moduleHres, moduleVres, dirh, dirv } = selectScreen(state);
  try {
    if (address) {
      const target = new Address(address);
      devicesSlice.then(({ selectDevicesByAddress, selectDeviceById, setDeviceValue }) => {
        const devices = deviceId
          ? [selectDeviceById(state, deviceId)]
          : selectDevicesByAddress(state, target);
        devices
          .filter(notEmpty)
          .filter(({ mib }) => mib.startsWith('minihost'))
          .forEach(({ id, address: devAddress }) => {
            debug(`initialize minihost ${devAddress}`);
            const setValue = setDeviceValue(id);
            Object.entries({
              hoffs: x,
              voffs: y,
              hres: width,
              vres: height,
              moduleHres,
              moduleVres,
              indication: 0,
              dirh,
              dirv,
            }).forEach(([name, value]) => {
              // debug(`setValue ${name} = ${value}`);
              value !== undefined && dispatch(setValue(name, value));
            });
          });
      });
    }
  } catch (err) {
    console.error('error while activate test', err.message);
  }
};

export const activateTest = (test: string | undefined): AppThunk => dispatch => {
  dispatch(setCurrentTest(test));
  dispatch(setCurrentTab('tests'));
  dispatch(initializeMinihosts());
};

const updateBrightness = debounce<AppThunk>((dispatch, getState) => {
  // console.log('updateBrightness', new Date().toLocaleTimeString());
  devicesSlice.then(({ selectAllDevices, setDeviceValue }) => {
    const brightness = selectCurrentBrightness(getState());
    if (brightness === undefined) return;
    const devices = selectAllDevices(getState()).filter(({ mib }) => mib.startsWith('minihost'));
    devices.forEach(({ id }) => dispatch(setDeviceValue(id)('brightness', brightness)));
  });
}, 500);

export const setCurrentBrightness = (value: number): AppThunk => dispatch => {
  dispatch(currentSlice.actions.setBrightness(value));
  dispatch(updateBrightness);
};

export const loadConfig = (id: SessionId, config: Config): AppThunk => dispatch => {
  const data = { test: undefined, ...config };
  if (!validateConfig(data)) console.error('Invalid configuration data received');
  dispatch(currentSlice.actions.loadConfig(data));
  dispatch(updateBrightness);
};

const getValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const calculateBrightness: AppThunk = (dispatch, getState) => {
  const state = getState();
  const autobrightness = selectAutobrightness(state);
  if (!autobrightness) return;
  const spline = selectCurrentSpline(state);
  const illuminance = selectLastAverage(state, 'illuminance');
  // console.log({ illuminance });
  let brightness = selectCurrentBrightness(state);
  const { latitude, longitude } = selectCurrentLocation(state) ?? {};
  const isValidLocation = latitude !== undefined && longitude !== undefined;
  if (spline) {
    const safeData = sortBy(spline.filter(notEmpty), ([lux]) => lux);
    const [min] = safeData;
    const max = safeData[safeData.length - 1];
    const [minLux, minBrightness] = min;
    const [maxLux, maxBrightness] = max;
    // debug(`min: ${minBrightness}, max: ${maxBrightness}`);
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
        dawn,
        sunriseEnd,
        goldenHourEnd,
        solarNoon,
        goldenHour,
        sunsetStart,
        dusk,
      } = SunCalc.getTimes(now, latitude!, longitude!);
      debug(
        `dawn: ${dawn.toLocaleTimeString()}, sunriseEnd: ${sunriseEnd.toLocaleTimeString()}, goldenHourEnd: ${goldenHourEnd.toLocaleTimeString()}, noon: ${solarNoon.toLocaleTimeString()}`
      );
      debug(
        `goldenHour: ${goldenHour.toLocaleTimeString()}, sunsetStart: ${sunsetStart.toLocaleTimeString()}, dusk: ${dusk.toLocaleTimeString()}`
      );
      // debug(`now: ${getTime(now)}`);
      const sunSpline =
        now <= solarNoon
          ? new MonotonicCubicSpline([
              [getTime(dawn), getBrightness(0)],
              [getTime(sunriseEnd), getBrightness(1 / 2)],
              [getTime(goldenHourEnd), getBrightness(3 / 4)],
              [getTime(solarNoon), getBrightness(1)],
            ])
          : new MonotonicCubicSpline([
              [getTime(solarNoon), getBrightness(1)],
              [getTime(goldenHour), getBrightness(3 / 4)],
              [getTime(sunsetStart), getBrightness(1 / 2)],
              [getTime(dusk), getBrightness(0)],
            ]);
      brightness = getValue(
        Math.round(sunSpline.interpolate(getTime(now))),
        minBrightness,
        maxBrightness
      );
    }
  }
  dispatch(setCurrentBrightness(brightness));
};

// export const setAutobrightness = (on: boolean): AppThunk => dispatch => {
//   dispatch(currentSlice.actions.setAutobrightness(on));
// };

let brightnessTimer = 0;

export const initializeCurrent: AsyncInitializer = async (dispatch, getState: () => RootState) => {
  const { selectIsRemote } = await sessionSlice;
  if (!selectIsRemote(getState())) {
    if (!brightnessTimer) {
      brightnessTimer = window.setInterval(
        () => dispatch(calculateBrightness),
        BRIGHTNESS_INTERVAL
      );
    }
  }
};

export default currentSlice.reducer;
