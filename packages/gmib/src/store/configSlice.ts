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
import { createSlice, current, nanoid, PayloadAction } from '@reduxjs/toolkit';
import Ajv from 'ajv';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';
import semverLt from 'semver/functions/lt';
import SunCalc from 'suncalc';
import {
  Config,
  configSchema,
  convertCfgFrom,
  convertCfgTo,
  defaultScreen,
  Location,
  Page,
  reAddress,
  Screen,
} from '../util/config';
import debugFactory from '../util/debug';
import {
  findById,
  incrementCounterString,
  notEmpty,
  PropPayload,
  PropPayloadAction,
  tuplify,
} from '../util/helpers';
import MonotonicCubicSpline, { Point } from '../util/MonotonicCubicSpline';
import { getCurrentNibusSession, isRemoteSession } from '../util/nibus';
import type { AsyncInitializer } from './asyncInitialMiddleware';
import type { DeviceState, ValueType } from './devicesSlice';
import type { AppDispatch, AppThunk, RootState } from './index';
import { setNovastarBrightness } from './novastarsSlice';
import { selectLastAverage } from './sensorsSlice';

const debug = debugFactory('gmib:configSlice');

// cyclic dependency
const devicesSlice = import('./devicesSlice');

const BRIGHTNESS_INTERVAL = 60 * 1000;

const ajv = new Ajv({ removeAdditional: 'failing' });

export interface ConfigState extends Config {
  // readonly session: SessionId;
  loading: boolean;
}

const initialState: ConfigState = {
  brightness: 30,
  autobrightness: false,
  spline: undefined,
  // session: `${params.get('host') || ''}:${params.get('port') || 9001}` as SessionId,
  screens: [],
  logLevel: 'none',
  pages: [],
  version: undefined,
  loading: true,
};

// export type RemoteSession = { id: SessionId; isPersist: boolean };

const validateConfig = ajv.compile({
  type: 'object',
  additionalProperties: false,
  properties: configSchema,
});

export const sendConfig = debounce((state: ConfigState): void => {
  const { loading, ...config } = state;
  const session = getCurrentNibusSession();
  if (!validateConfig(config)) console.warn(`error while validate config`);
  const cfg =
    !config.version || semverLt(config.version, '3.1.0') ? convertCfgTo(config) : { ...config };
  session.saveConfig(cfg);
}, 500);

export const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    showHttpPage(state, { payload: [scrId, pageId] }: PayloadAction<[string, string | undefined]>) {
      const screen = findById(state.screens, scrId);
      if (screen) {
        screen.output = pageId;
        sendConfig(current(state));
      }
    },
    setBrightness(state, { payload: brightness }: PayloadAction<number>) {
      state.brightness = Math.round(Math.max(Math.min(brightness, 100), 0));
      sendConfig(current(state));
    },
    setAutobrightness(state, { payload: on }: PayloadAction<boolean>) {
      state.autobrightness = on;
      sendConfig(current(state));
    },
    // updateCurrentSession(state, { payload: id }: PayloadAction<SessionId>) {
    //   if (id === state.session) return;
    //   const save = savers[state.session];
    //   state.session = id;
    //   save && save.flush();
    // },
    setSpline(state, { payload: spline }: PayloadAction<Config['spline']>) {
      state.spline = spline;
      sendConfig(current(state));
    },
    setLocationProp(state, { payload: [prop, value] }: PropPayloadAction<Location>) {
      if (!state.location) state.location = {};
      state.location[prop] = value;
      sendConfig(current(state));
    },
    setScreenProp(
      state,
      { payload: [scrId, [prop, value]] }: PayloadAction<[string, PropPayload<Screen>]>
    ) {
      const screen = findById(state.screens, scrId);
      if (!screen) return;
      screen[prop] = value as never;
      sendConfig(current(state));
    },
    updateConfig(state, { payload: config }: PayloadAction<Config>) {
      Object.assign(state, config);
      state.loading = false;
    },
    setLogLevel(state, { payload: logLevel }: PayloadAction<LogLevel>) {
      const session = getCurrentNibusSession();
      state.logLevel = logLevel;
      session.setLogLevel(logLevel);
      sendConfig(current(state));
    },
    upsertHttpPage(state, { payload: page }: PayloadAction<Page>) {
      const found = findById(state.pages, page.id);
      if (found) {
        Object.assign(found, page);
      } else {
        state.pages.push(page);
      }
      sendConfig(current(state));
    },
    removeHttpPage(state, { payload: id }: PayloadAction<string>) {
      state.pages = state.pages.filter(page => page.id !== id);
      sendConfig(current(state));
    },

    addAddress(state, { payload: [scrId, address] }: PayloadAction<[string, string]>) {
      const screen = findById(state.screens, scrId);
      if (!screen) return;
      if (!screen.addresses) screen.addresses = [];
      screen.addresses = [...screen.addresses, address];
      sendConfig(current(state));
    },
    removeAddress(
      state,
      { payload: [scrId, chip, index] }: PayloadAction<[string, string, number]>
    ) {
      const screen = findById(state.screens, scrId);
      if (!screen?.addresses) return;
      if (screen.addresses[index] === chip) screen.addresses.splice(index, 1);
      sendConfig(current(state));
    },
    addScreen(state, { payload: [id, name] }: PayloadAction<[string, string]>) {
      state.screens.push({ ...defaultScreen, id, name });
      // saveConfig(current(state));
    },
    removeScreen(state, { payload: id }: PayloadAction<string>) {
      const index = state.screens.findIndex(screen => screen.id === id);
      if (index !== -1) {
        state.screens.splice(index, 1);
        if (state.screens.length === 1) {
          state.screens[0].brightnessFactor = 1;
        }
        sendConfig(current(state));
      }
    },
  },
});

export const selectConfig = (state: RootState): ConfigState => state.config;

// export const selectOutput = (state: RootState): string | undefined => selectConfig(state).test;

export const selectLoading = (state: RootState): boolean => selectConfig(state).loading;

export const selectBrightness = (state: RootState): number => selectConfig(state).brightness;

export const selectAutobrightness = (state: RootState): boolean =>
  selectConfig(state).autobrightness;

export const selectSpline = (state: RootState): Config['spline'] => selectConfig(state).spline;

export const selectLocation = (state: RootState): Config['location'] =>
  selectConfig(state).location;

export const selectScreens = (state: RootState): Screen[] => selectConfig(state).screens;

export const selectScreenById = (state: RootState, id?: string): Screen | undefined =>
  (id && findById(selectConfig(state).screens, id)) || undefined;

export const selectLogLevel = (state: RootState): LogLevel => selectConfig(state).logLevel;

export const selectAllPages = (state: RootState): Page[] => selectConfig(state).pages;

export const selectPageById = (state: RootState, id: string): Page | undefined =>
  findById(selectAllPages(state), id);

export const selectSessionVersion = (state: RootState): string | undefined =>
  selectConfig(state).version;

export const selectScreenAddresses = (state: RootState): string[] =>
  [
    ...new Set(
      selectScreens(state).reduce<string[]>(
        (res, { addresses }) =>
          addresses ? [...res, ...addresses.map(address => address.replace(/[+-].*$/, ''))] : res,
        []
      )
    ),
  ].sort();

export const {
  addScreen,
  removeScreen,
  showHttpPage,
  setAutobrightness,
  setSpline,
  setLocationProp,
  // setScreenProp,
  setLogLevel,
  upsertHttpPage,
  removeHttpPage,
  addAddress,
  removeAddress,
  updateConfig,
} = configSlice.actions;

export const createScreen = (): AppThunk => (dispatch, getState) => {
  let name = 'Экран';
  const screens = selectScreens(getState());
  const hasName = (n: string): boolean => screens.findIndex(screen => screen.name === n) !== -1;
  while (hasName(name)) {
    name = incrementCounterString(name);
  }
  const id = nanoid();
  dispatch(addScreen([id, name]));
  // dispatch(setCurrentScreen(id));
};

/*
export const deleteScreen = (id: string): AppThunk => (dispatch, getState) => {
  const state = getState();
  let screens = selectScreens(state);
  if (screens.length < 1) return;
  let currentScreen = selectCurrentScreenId(state);
  const index = screens.findIndex(screen => screen.id === id);
  if (index === -1) return;
  dispatch(removeScreen(id));
  // if (currentScreen === id) {
  //   screens = selectScreens(getState());
  //   currentScreen =
  //     screens.length > 0 ? screens[Math.min(index, screens.length - 1)].id : undefined;
  //   dispatch(setCurrentScreen(currentScreen));
  // }
};
*/

type HostParams = {
  address: Address;
  left: number;
  top: number;
  width: number;
  height: number;
};

type Input = Pick<Required<Screen>, 'width' | 'height' | 'x' | 'y'>;

const getHostParams = (screen: Input) => (expr: string): HostParams | undefined => {
  const matches = expr.match(reAddress);
  if (!matches) return undefined;
  const [, address, l, t, w, h] = matches;
  const left = l ? +l : 0;
  const top = t ? +(+t) : 0;
  const width = w ? +w : Math.max(screen.width - left, 0);
  const height = h ? +h : Math.max(screen.height - top, 0);
  return {
    address: new Address(address),
    left: screen.x + left,
    top: screen.y + top,
    width,
    height,
  };
};

export const initializeScreens = (scrId?: string): AppThunk => (dispatch, getState) => {
  const state = getState();
  const scr = scrId && selectScreenById(state, scrId);
  const screens = scr ? [scr] : selectConfig(state).screens;
  screens.forEach(screen => {
    const { addresses, moduleHres, moduleVres, dirh, dirv } = screen;
    const getParams = getHostParams(screen as Input);
    try {
      if (addresses) {
        addresses
          .map(getParams)
          .filter(notEmpty)
          .forEach(({ address, left, top, width, height }) => {
            const target = new Address(address);
            devicesSlice.then(({ selectDevicesByAddress, setDeviceValue }) => {
              const devices = selectDevicesByAddress(state, target);
              devices
                .filter(notEmpty)
                // .filter(({ mib }) => mib.startsWith('minihost'))
                .forEach(({ id, address: devAddress, mib }) => {
                  debug(`initialize ${devAddress}`);
                  const setValue = setDeviceValue(id);
                  let props: Record<string, ValueType | undefined> = {};
                  if (mib.startsWith('minihost')) {
                    props = {
                      hoffs: left,
                      voffs: top,
                      hres: width,
                      vres: height,
                      moduleHres,
                      moduleVres,
                      indication: 0,
                      dirh,
                      dirv,
                    };
                  } else if (mib === 'mcdvi') {
                    props = {
                      // moduleHres,
                      // moduleVres,
                      indication: 0,
                      hres: width,
                      vres: height,
                      hofs: left,
                      vofs: top,
                    };
                  }
                  Object.entries(props).forEach(([name, value]) => {
                    // debug(`setValue ${name} = ${value}`);
                    value !== undefined && dispatch(setValue(name, value));
                  });
                });
            });
          });
      }
    } catch (err) {
      debug(`error while initialize screen ${screen.name}: ${err.message}`);
    }
  });
};

const updateScreen = debounce((dispatch: AppDispatch, scrId: string): void => {
  dispatch(initializeScreens(scrId));
}, 3000);

export const setScreenProp = (
  scrId: string,
  [prop, value]: PropPayload<Screen>
): AppThunk => dispatch => {
  dispatch(configSlice.actions.setScreenProp([scrId, [prop, value]]));
  updateScreen(dispatch, scrId);
};

export const activateHttpPage = (
  scrId: string,
  pageId: string | undefined
): AppThunk => dispatch => {
  dispatch(showHttpPage([scrId, pageId]));
  // dispatch(setCurrentTab('screens'));
  dispatch(initializeScreens(scrId));
};

const updateBrightness = debounce<AppThunk>((dispatch, getState) => {
  // console.log('updateBrightness', new Date().toLocaleTimeString());
  devicesSlice.then(({ setDeviceValue, selectDevicesByAddress }) => {
    const state = getState();
    const brightness = selectBrightness(state);
    if (brightness === undefined) return;
    const screens = selectScreens(state);
    const tasks = screens
      .filter(({ brightnessFactor }) => brightnessFactor && brightnessFactor > 0)
      .reduce<[DeviceId, number][]>((res, { addresses, brightnessFactor }) => {
        if (!addresses) return res;
        return [
          ...res,
          ...addresses
            .reduce<DeviceState[]>(
              (devs, address) => [...devs, ...selectDevicesByAddress(state, address)],
              []
            )
            .map(({ id }) => tuplify(id, Math.round(brightnessFactor! * brightness))),
        ];
      }, []);
    tasks.forEach(([id, value]) => dispatch(setDeviceValue(id)('brightness', value)));
  });
}, 500);

export const setCurrentBrightness = (value: number): AppThunk => dispatch => {
  dispatch(configSlice.actions.setBrightness(value));
  dispatch(setNovastarBrightness(value));
  dispatch(updateBrightness);
};

export const loadConfig = (config: Config): AppThunk => async dispatch => {
  const data = convertCfgFrom(config);
  if (!validateConfig(data)) console.error('Invalid configuration data received');
  dispatch(updateConfig(data));
  dispatch(updateBrightness);
  /*
  const state = getState();
  // debug(`load Config ${JSON.stringify(state)}`);
  const screens = selectScreens(state).map(({ id: scr }) => scr);
  const currentScreen = selectCurrentScreenId(state);
  if (screens.length > 0 && (!currentScreen || !screens.includes(currentScreen))) {
    dispatch(setCurrentScreen(screens[0]));
    // debug(`select screen ${screens[0]}`);
  }
*/
};

const getValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const calculateBrightness: AppThunk = (dispatch, getState) => {
  const state = getState();
  const autobrightness = selectAutobrightness(state);
  if (!autobrightness) return;
  const spline = selectSpline(state);
  const illuminance = selectLastAverage(state, 'illuminance');
  // console.log({ illuminance });
  let brightness = selectBrightness(state);
  const { latitude, longitude } = selectLocation(state) ?? {};
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
      // debug(
      //   `dawn: ${dawn.toLocaleTimeString()}, sunriseEnd: ${sunriseEnd.toLocaleTimeString()}, goldenHourEnd: ${goldenHourEnd.toLocaleTimeString()}, noon: ${solarNoon.toLocaleTimeString()}`
      // );
      // debug(
      //   `goldenHour: ${goldenHour.toLocaleTimeString()}, sunsetStart: ${sunsetStart.toLocaleTimeString()}, dusk: ${dusk.toLocaleTimeString()}`
      // );
      // debug(`now: ${getTime(now)}`);
      if (now > dawn && now < dusk) {
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
      } else brightness = minBrightness;
    }
  }
  dispatch(setCurrentBrightness(brightness));
};

let brightnessTimer = 0;

export const initializeConfig: AsyncInitializer = dispatch => {
  if (!isRemoteSession && !brightnessTimer) {
    brightnessTimer = window.setInterval(() => dispatch(calculateBrightness), BRIGHTNESS_INTERVAL);
  }
};

export default configSlice.reducer;
