import { createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import flatten from 'lodash/flatten';
import sortBy from 'lodash/sortBy';
import SunCalc from 'suncalc';

import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import novastarApi, { selectNovastarIds, selectSerials } from '../api/novastar';
import screenApi, { parseLocation, selectScreen, selectScreens } from '../api/screens';
import type { Point } from '../util/MonotonicCubicSpline';
import MonotonicCubicSpline from '../util/MonotonicCubicSpline';

import { asyncSerial, MINUTE, notEmpty } from '/@common/helpers';
import { isRemoteSession } from '/@common/remote';

import {
  brightnessDown,
  brightnessUp,
  invalidateBrightness,
  setAutobrightness,
  setBrightness,
  setDisableNet,
  setHidProp,
  setLocationProp,
  setLogLevel,
  setNightMode,
  setProtectionProp,
  setSpline,
  setSunSpline,
  updateConfig,
} from './configSlice';
import { setCurrentDevice } from './currentSlice';
import { startAppListening } from './listenerMiddleware';
import {
  selectAutobrightness,
  selectBrightness,
  selectConfig,
  selectCurrentDeviceId,
  selectDeviceIds,
  selectDevicesByAddress,
  selectDisableNet,
  selectHID,
  selectLastAverage,
  selectLocation,
  selectLogLevel,
  selectNightMode,
  selectOverheatProtection,
  selectSpline,
  selectSunSpline,
} from './selectors';

import type { AppThunkConfig } from '.';
import type { NightBrightnessMode, SunEvent, SunReference, SunSplineItem } from '/@common/config';

export const BRIGHTNESS_INTERVAL = 60 * 1000;

const getValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const DAY = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeReferencePattern = /^time:([01]\d|2[0-3]):([0-5]\d)$/;

const getDayStart = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getTime = (date: Date, dayStart = getDayStart(date)): number =>
  date.getTime() - dayStart.getTime();

const getTimeOfDay = (date: Date): number =>
  (date.getHours() * 60 + date.getMinutes()) * MINUTE_MS +
  date.getSeconds() * 1000 +
  date.getMilliseconds();

const getTimeValue = (value: string | undefined): number | undefined => {
  const matches = value?.match(timePattern);
  return matches ? (+matches[1] * 60 + +matches[2]) * MINUTE_MS : undefined;
};

const getNightModeBrightness = (
  { start, end, brightness }: NightBrightnessMode = {},
  date: Date,
): number | undefined => {
  const startTime = getTimeValue(start);
  const endTime = getTimeValue(end);
  if (startTime === undefined || endTime === undefined || brightness === undefined)
    return undefined;
  const now = getTime(date);
  const active =
    startTime <= endTime ? now >= startTime && now < endTime : now >= startTime || now < endTime;
  return active ? getValue(Math.round(brightness), 0, 100) : undefined;
};

const getSunReferenceTime = (
  reference: SunReference,
  date: Date,
  latitude: number,
  longitude: number,
): number | undefined => {
  const timeMatches = reference.match(timeReferencePattern);
  if (timeMatches) return (+timeMatches[1] * 60 + +timeMatches[2]) * 60 * 1000;

  if (!reference.startsWith('event:')) return undefined;
  const event = reference.slice('event:'.length) as SunEvent;
  const eventTime = SunCalc.getTimes(date, latitude, longitude)[event];
  return eventTime instanceof Date && !Number.isNaN(eventTime.getTime())
    ? getTimeOfDay(eventTime)
    : undefined;
};

const interpolateCyclicSpline = (points: Point[], value: number): number | undefined => {
  const sorted = sortBy(points, ([time]) => time);
  if (sorted.length === 0) return undefined;
  if (sorted.length === 1) return sorted[0][1];

  const [first] = sorted;
  const last = sorted[sorted.length - 1];
  const wrappedPoints: Point[] =
    value < first[0]
      ? ([[last[0] - DAY, last[1]], ...sorted] as Point[])
      : ([...sorted, [first[0] + DAY, first[1]]] as Point[]);
  return new MonotonicCubicSpline(wrappedPoints).interpolate(value);
};

const calculateSunBrightness = (
  spline: SunSplineItem[] | undefined,
  date: Date,
  latitude: number,
  longitude: number,
): number | undefined => {
  if (!spline) return undefined;
  const points = spline
    .filter(notEmpty)
    .map<Point | undefined>(([reference, brightness]) => {
      const time = getSunReferenceTime(reference, date, latitude, longitude);
      return time === undefined ? undefined : [time, brightness];
    })
    .filter(notEmpty);
  const result = interpolateCyclicSpline(points, getTime(date));
  return result === undefined ? undefined : getValue(Math.round(result), 0, 100);
};

// const hasBrightnessFactor = hasProps('brightnessFactor');

const selectScreensData = screenApi.endpoints.getScreens.select();
const selectNovastarData = novastarApi.endpoints.getNovastars.select();

// setTimeout(() => window.config.get('announce').then(console.log), 1000);

// TODO: Нужна возможность добавления в экраны novastar подключенные по USB
export const updateBrightness = createDebouncedAsyncThunk<
  void,
  undefined | number | number[],
  AppThunkConfig
>(
  'config/updateBrightness',
  async (ids, { dispatch, getState }) => {
    const state = getState();
    // debouncedUpdateNovastarDevices(state);
    const brightness = selectBrightness(state);
    const disableNet = selectDisableNet(state);
    const hid = selectHID(state);
    const { data: novastarData } = selectNovastarData(state);
    const { interval } = selectOverheatProtection(state) ?? {};
    const serials =
      disableNet && novastarData ? selectSerials(novastarData).map(({ path }) => path) : [];

    const { data: screensData } = selectScreensData(state);
    if (!screensData) return;
    const screens = ids
      ? (Array.isArray(ids) ? ids : [ids]).map(id => selectScreen(screensData, id))
      : selectScreens(screensData);
    const { timestamp, screens: scr = {} } = await window.config.get('health');
    const isValid = timestamp && interval && Date.now() - timestamp < 2 * interval * MINUTE;
    const hidBrightness =
      hid?.VID && hid.PID && hid.brightness != null
        ? Math.max(hid.brightness, hid.minBrightness ?? 0)
        : undefined;
    const tasks = flatten(
      screens
        .filter(notEmpty)
        .map(
          ({
            brightnessFactor,
            brightness: scrBrightness,
            addresses = [],
            id: screenId,
            useExternalKnob,
          }) => {
            let desired = scrBrightness ?? 60;
            if (brightnessFactor && brightnessFactor > 0)
              desired = Math.round(brightnessFactor * brightness);
            else if (useExternalKnob && hidBrightness != null) desired = hidBrightness;
            const value = Math.min(desired, isValid ? (scr[screenId]?.maxBrightness ?? 100) : 100);
            return [
              ...serials.map(path => [path, value] as const),
              ...addresses
                .map(address => parseLocation(address)?.address ?? address)
                .map(address => [address, value] as const),
            ];
          },
        )
        .filter(notEmpty),
    );
    // console.log('BRIGHTNESS', Date.now() % 10000, tasks.map(([, value]) => value).join(','));
    await Promise.allSettled(
      tasks.map(([address, value]) =>
        typeof address === 'string'
          ? // ? window.novastar.setBrightness({ path: address, screen: -1, percent: value })
            dispatch(
              novastarApi.endpoints.setBrightness.initiate({ path: address, screen: -1, value }),
            )
          : asyncSerial(selectDevicesByAddress(state, address), ({ id: deviceId }) =>
              window.nibus.setDeviceValue(deviceId)('brightness', value),
            ),
      ),
    );
  },
  100,
  {
    maxWait: 250,
    leading: true,
    selectId: id => (Array.isArray(id) ? id.join(',') : (id ?? 0)),
  },
);

// export const setCurrentBrightness = (value: number): AppThunk => dispatch => {
//   dispatch(setBrightness(value));
//   dispatch(updateBrightness());
// };

startAppListening({
  actionCreator: setBrightness,
  // matcher: isAnyOf(setBrightness, updateConfig),
  effect(_, { dispatch }) {
    void dispatch(updateBrightness());
  },
});

const calculateBrightness = createAsyncThunk<void, void, AppThunkConfig>(
  'config/calculateBrightness',
  (_, { dispatch, getState }) => {
    const state = getState();
    const autobrightness = selectAutobrightness(state);
    if (!autobrightness) return;
    const spline = selectSpline(state);
    const sunSpline = selectSunSpline(state);
    const nightMode = selectNightMode(state);
    const illuminance = selectLastAverage(state, 'illuminance');
    // console.log({ illuminance });
    let brightness = selectBrightness(state);
    const now = new Date();
    const nightBrightness = getNightModeBrightness(nightMode, now);
    if (nightBrightness !== undefined) {
      dispatch(setBrightness(nightBrightness));
      return;
    }
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
      }
    }
    if (illuminance === undefined && isValidLocation) {
      brightness = calculateSunBrightness(sunSpline, now, latitude, longitude) ?? brightness;
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
    setSunSpline,
    setNightMode,
    setLocationProp,
    setHidProp,
    // setScreenProp,
    setLogLevel,
    // addAddress,
    // removeAddress,
    // addScreen,
    // removeScreen,
    setProtectionProp,
    setDisableNet,
    brightnessUp,
    brightnessDown,
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
    window.setLogLevel(logLevel);
    // window.nibus.setLogLevel(logLevel);
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
        brightnessTimer = window.setInterval(() => {
          void dispatch(calculateBrightness());
        }, BRIGHTNESS_INTERVAL);
      }
    },
  });
}
/**
 * Лишняя action из-за циклической зависимости
 */
startAppListening({
  actionCreator: invalidateBrightness,
  effect({ payload: screenId }, { dispatch }) {
    void dispatch(updateBrightness(screenId));
  },
});

// startAppListening({
//   actionCreator: addNovastar,
//   effect: async ({ payload: { path } }, { dispatch }) => {
//     await window.novastar.reload(path);
//     dispatch(updateBrightness());
//   },
// });

startAppListening({
  predicate: (_, currentState) => !selectCurrentDeviceId(currentState),
  effect(_, { getState, dispatch }) {
    const state = getState();
    const { data } = selectNovastarData(state);
    let ids = selectDeviceIds(state);
    if (ids.length === 0 && data) ids = data ? selectNovastarIds(data) : [];
    const [id] = ids;
    id && dispatch(setCurrentDevice(id));
  },
});

startAppListening({
  matcher: isAnyOf(brightnessUp, brightnessDown),
  effect: (_, { getState, dispatch }) => {
    const { data: screensData } = selectScreensData(getState());
    if (!screensData) return;
    const screens = selectScreens(screensData);
    const ids = screens.filter(screen => screen.useExternalKnob).map(screen => screen.id);
    if (ids.length) void dispatch(updateBrightness(ids));
  },
});
