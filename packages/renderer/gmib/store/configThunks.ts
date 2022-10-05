import { createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import sortBy from 'lodash/sortBy';
import SunCalc from 'suncalc';

import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import screenApi, { parseLocation, selectScreens } from '../api/screens';
import type { Point } from '../util/MonotonicCubicSpline';
import MonotonicCubicSpline from '../util/MonotonicCubicSpline';

import { MINUTE, notEmpty, tuplify } from '/@common/helpers';
import { isRemoteSession } from '/@common/remote';

import {
  removeHttpPage,
  setAutobrightness,
  setBrightness,
  setLocationProp,
  setLogLevel,
  setProtectionProp,
  setSpline,
  updateConfig,
  upsertHttpPage,
} from './configSlice';
import type { DeviceState } from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  selectAutobrightness,
  selectBrightness,
  selectConfig,
  selectDevicesByAddress,
  selectLastAverage,
  selectLocation,
  selectLogLevel,
  selectOverheatProtection,
  selectSpline,
} from './selectors';

import type { AppThunkConfig, RootState } from './index';

import type { DeviceId } from '@nibus/core';
import { hasProps } from '@novastar/screen/common';
import { reAddress } from '../../../common/config';

export const BRIGHTNESS_INTERVAL = 60 * 1000;

const getValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const hasBrightnessFactor = hasProps('brightnessFactor');

export const updateBrightness = createDebouncedAsyncThunk<void, void, AppThunkConfig>(
  'config/updateBrightness',
  async (_, { getState }) => {
    const state = getState();
    const brightness = selectBrightness(state);
    const { interval } = selectOverheatProtection(state) ?? {};
    if (brightness === undefined) return;
    const { data: screensData } = screenApi.endpoints.getScreens.select()(state);
    const screens = screensData ? selectScreens(screensData) : [];
    const { timestamp, screens: scr } = await window.config.get('health');
    const tasks = screens
      .filter(hasBrightnessFactor)
      .filter(({ brightnessFactor }) => brightnessFactor > 0)
      .reduce<[DeviceId, number][]>((res, { brightnessFactor, addresses: original, id: screenId }) => {
        const addresses = original?.filter(address => reAddress.test(address));
        if (!addresses) return res;
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

/*
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

*/

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

/*
startAppListening({
  matcher: isAnyOf(setScreenProp, showHttpPage, updateConfig),
  effect(action, { dispatch }) {
    if (setScreenProp.match(action) || showHttpPage.match(action)) {
      const {
        payload: [scrId],
      } = action;
      dispatch(updateScreen(scrId));
    } else if (updateConfig.match(action)) {
      const { payload: config } = action;
      config.screens.forEach(({ id }) => dispatch(updateScreen(id)));
    }
  },
});
*/

startAppListening({
  matcher: isAnyOf(
    // showHttpPage,
    setBrightness,
    setAutobrightness,
    setSpline,
    setLocationProp,
    // setScreenProp,
    setLogLevel,
    upsertHttpPage,
    removeHttpPage,
    // addAddress,
    // removeAddress,
    // addScreen,
    // removeScreen,
    setProtectionProp,
  ),
  effect(action, { getState }) {
    const config = selectConfig(getState());
    window.nibus.sendConfig(config);
  },
});

startAppListening({
  matcher: isAnyOf(setLogLevel, updateConfig),
  effect(_, { getState }) {
    const logLevel = selectLogLevel(getState());
    window.nibus.setLogLevel(logLevel);
  },
});

let brightnessTimer = 0;

if (!isRemoteSession) {
  startAppListening({
    matcher: isAnyOf(setAutobrightness, updateConfig),
    effect(_, { dispatch, getState }) {
      const on = selectAutobrightness(getState());
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
