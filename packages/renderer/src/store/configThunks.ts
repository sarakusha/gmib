import type { DeviceId } from '@nibus/core';
import Address from '@nibus/core/lib/Address';
import { hasProps } from '@novastar/screen/lib/common';
import { createAsyncThunk, isAnyOf, nanoid } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import sortBy from 'lodash/sortBy';
import SunCalc from 'suncalc';

import type { Point } from '../util/MonotonicCubicSpline';
import MonotonicCubicSpline from '../util/MonotonicCubicSpline';

import type { Screen } from '/@common/config';
import { reAddress } from '/@common/config';
import type { ValueType } from '/@common/helpers';
import {
  incrementCounterString,
  MINUTE,
  notEmpty,
  toErrorMessage,
  tuplify,
} from '/@common/helpers';
import { isRemoteSession } from '/@common/remote';

import {
  addAddress,
  addScreen,
  removeAddress,
  removeHttpPage,
  removeScreen,
  setAutobrightness,
  setBrightness,
  setLocationProp,
  setLogLevel,
  setProtectionProp,
  setScreenProp,
  setSpline,
  showHttpPage,
  updateConfig,
  upsertHttpPage,
} from './configSlice';
import createDebouncedAsyncThunk from './createDebouncedAsyncThunk';
import type { DeviceState } from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  selectAutobrightness,
  selectBrightness,
  selectConfig,
  selectDevicesByAddress,
  selectLastAverage,
  selectLocation,
  selectOverheatProtection,
  selectScreenById,
  selectScreens,
  selectSpline,
} from './selectors';

import type { AppThunk, AppThunkConfig, RootState } from './index';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);

export const BRIGHTNESS_INTERVAL = 60 * 1000;

const getValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

type Location = {
  address: Address;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type HostParams = Required<Location>;

const safeNumber = (value: string | undefined): number | undefined =>
  value !== undefined ? +value : undefined;

const parseLocation = (location: string): Location | undefined => {
  const matches = location.match(reAddress);
  if (!matches) return undefined;
  const [, address, l, t, w, h] = matches;
  return {
    address: new Address(address),
    left: safeNumber(l),
    top: safeNumber(t),
    width: safeNumber(w),
    height: safeNumber(h),
  };
};

type Input = Pick<Required<Screen>, 'width' | 'height' | 'x' | 'y'>;

const getHostParams =
  (screen: Input) =>
  (expr: string): HostParams | undefined => {
    // const matches = expr.match(reAddress);
    // if (!matches) return undefined;
    // const [, address, l, t, w, h] = matches;
    // const left = l ? +l : 0;
    // const top = t ? +(+t) : 0;
    const location = parseLocation(expr);
    if (!location) return undefined;
    const { left = 0, top = 0, address } = location;
    const width = location.width ?? Math.max(screen.width - left, 0);
    const height = location.height ?? Math.max(screen.height - top, 0);
    return {
      address,
      left: screen.x + left,
      top: screen.y + top,
      width,
      height,
    };
  };

const hasBrightnessFactor = hasProps('brightnessFactor');

export const updateBrightness = createDebouncedAsyncThunk<void>(
  'config/updateBrightness',
  async (_, { getState }) => {
    const state = getState();
    const brightness = selectBrightness(state);
    const { interval } = selectOverheatProtection(state) ?? {};
    if (brightness === undefined) return;
    const screens = selectScreens(state);
    const tasks = screens
      .filter(hasBrightnessFactor)
      .filter(({ brightnessFactor }) => brightnessFactor > 0)
      .reduce<[DeviceId, number][]>((res, { brightnessFactor, addresses, id: screenId }) => {
        if (!addresses) return res;
        const { timestamp, screens: scr } = window.config.get('health');
        const isValid = timestamp && interval && Date.now() - timestamp < 2 * interval * MINUTE;
        const actualBrightness = Math.min(Math.round(brightnessFactor * brightness), 100);
        return [
          ...res,
          ...addresses
            .map(location => parseLocation(location)?.address)
            .filter(notEmpty)
            .reduce<DeviceState[]>(
              (devs, address) => [...devs, ...selectDevicesByAddress(state, address)],
              [],
            )
            .map(({ id }) =>
              tuplify(
                id,
                isValid
                  ? Math.min(
                      actualBrightness,
                      scr?.[screenId]?.maxBrightness ?? Number.MAX_SAFE_INTEGER,
                    )
                  : actualBrightness,
              ),
            ),
        ];
      }, []);
    await Promise.allSettled(
      tasks.map(([id, value]) => window.nibus.setDeviceValue(id)('brightness', value)),
    );
  },
  100,
  {
    maxWait: 1000,
    leading: true,
  },
);

// export const setCurrentBrightness = (value: number): AppThunk => dispatch => {
//   dispatch(setBrightness(value));
//   dispatch(updateBrightness());
// };

startAppListening({
  matcher: isAnyOf(setBrightness, updateConfig),
  effect(_, { dispatch }) {
    dispatch(updateBrightness());
  },
});

const calculateBrightness = createAsyncThunk<void, void, AppThunkConfig>(
  'config/calculateBrightness',
  (_, { dispatch, getState }) => {
    const state = getState() as RootState;
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
          safeData.map<Point>(([lux, bright]) => [Math.log(1 + lux), bright]),
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
        const { dawn, sunriseEnd, goldenHourEnd, solarNoon, goldenHour, sunsetStart, dusk } =
          SunCalc.getTimes(now, latitude, longitude);
        // debug(
        //   `dawn: ${dawn.toLocaleTimeString()}, sunriseEnd: ${sunriseEnd.toLocaleTimeString()},
        // goldenHourEnd: ${goldenHourEnd.toLocaleTimeString()}, noon:
        // ${solarNoon.toLocaleTimeString()}` ); debug( `goldenHour:
        // ${goldenHour.toLocaleTimeString()}, sunsetStart: ${sunsetStart.toLocaleTimeString()},
        // dusk: ${dusk.toLocaleTimeString()}` ); debug(`now: ${getTime(now)}`);
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
            maxBrightness,
          );
        } else brightness = minBrightness;
      }
    }
    dispatch(setBrightness(brightness));
  },
);

// export const loadConfig = (config: Config): AppThunk => async dispatch => {
//   const data = convertCfgFrom(config);
//   if (!validateConfig(data)) console.error('Invalid configuration data received');
//   dispatch(updateConfig(data));
//   // dispatch(updateBrightness());
// };

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

export const updateScreen = createDebouncedAsyncThunk<void, string | undefined>(
  'config/updateScreen',
  (scrId, { getState }) => {
    const state = getState() as RootState;
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
              const devices = selectDevicesByAddress(state, target);
              devices
                .filter(notEmpty)
                // .filter(({ mib }) => mib.startsWith('minihost'))
                .forEach(({ id, address: devAddress, mib }) => {
                  debug(`initialize ${devAddress}`);
                  const setValue = window.nibus.setDeviceValue(id);
                  let props: Record<string, ValueType | undefined> = {};
                  switch (mib) {
                    case 'minihost3':
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
                      break;
                    case 'minihost_v2.06b':
                      props = {
                        hoffs: left,
                        voffs: top,
                        hres: width,
                        vres: height,
                        moduleHres,
                        moduleVres,
                        indication: 0,
                        hinvert: dirh,
                        vinvert: dirv,
                      };
                      break;
                    case 'mcdvi':
                      props = {
                        indication: 0,
                        hres: width,
                        vres: height,
                        hofs: left,
                        vofs: top,
                      };
                      break;
                    default:
                      break;
                  }
                  Object.entries(props).forEach(([name, value]) => {
                    // debug(`setValue ${name} = ${value}`);
                    value !== undefined && value !== null && setValue(name, value);
                  });
                });
            });
        }
      } catch (err) {
        debug(`error while initialize screen ${screen.name}: ${toErrorMessage(err)}`);
      }
    });
  },
  400,
  {
    selectId: id => id,
    leading: true,
    maxWait: 1000,
  },
);

// const updateScreen = debounce((dispatch: AppDispatch, scrId: string): void => {
//   dispatch(initializeScreens(scrId));
// }, 3000);

// export const setScreenProp = (
//   scrId: string,
//   [prop, value]: PropPayload<Screen>
// ): AppThunk => dispatch => {
//   dispatch(configSlice.actions.setScreenProp([scrId, [prop, value]]));
//   dispatch(updateScreen(scrId));
//   // updateScreen(dispatch, scrId);
// };

// export const activateHttpPage = (
//   scrId: string,
//   pageId: string | undefined
// ): AppThunk => dispatch => {
//   dispatch(showHttpPage([scrId, pageId]));
//   // dispatch(setCurrentTab('screens'));
//   dispatch(updateScreen(scrId));
// };

startAppListening({
  matcher: isAnyOf(setScreenProp, showHttpPage),
  effect({ payload: [scrId] }, { dispatch }) {
    dispatch(updateScreen(scrId));
  },
});

startAppListening({
  matcher: isAnyOf(
    showHttpPage,
    setBrightness,
    setAutobrightness,
    setSpline,
    setLocationProp,
    setScreenProp,
    setLogLevel,
    upsertHttpPage,
    removeHttpPage,
    addAddress,
    removeAddress,
    addScreen,
    removeScreen,
    setProtectionProp,
  ),
  effect(action, { getState }) {
    const config = selectConfig(getState());
    window.nibus.sendConfig(config);
  },
});

startAppListening({
  actionCreator: setLogLevel,
  effect({ payload: logLevel }) {
    window.nibus.setLogLevel(logLevel);
  },
});

let brightnessTimer = 0;

if (!isRemoteSession) {
  startAppListening({
    actionCreator: setAutobrightness,
    effect({ payload: on }, { dispatch }) {
      if (!on) {
        window.clearInterval(brightnessTimer);
        brightnessTimer = 0;
      } else if (!brightnessTimer) {
        brightnessTimer = window.setInterval(
          () => dispatch(calculateBrightness()),
          BRIGHTNESS_INTERVAL,
        );
      }
    },
  });
}
