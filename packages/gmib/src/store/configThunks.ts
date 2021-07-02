/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Address, DeviceId } from '@nibus/core';
import { nanoid } from '@reduxjs/toolkit';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';
import SunCalc from 'suncalc';
import { Config, convertCfgFrom, reAddress, Screen, validateConfig } from '../util/config';
import localConfig from '../util/localConfig';
import { incrementCounterString, MINUTE, notEmpty, PropPayload, tuplify } from '../util/helpers';
import MonotonicCubicSpline, { Point } from '../util/MonotonicCubicSpline';
import { isRemoteSession } from '../util/nibus';
import { AsyncInitializer } from './asyncInitialMiddleware';
import {
  addScreen,
  configSlice,
  selectAutobrightness,
  selectBrightness,
  selectConfig,
  selectLocation,
  selectOverheatProtection,
  selectScreenById,
  selectScreens,
  selectSpline,
  setBrightness,
  showHttpPage,
  updateConfig,
} from './configSlice';
import { DeviceState, selectDevicesByAddress, setDeviceValue, ValueType } from './devicesSlice';
import type { AppDispatch, AppThunk } from './index';
import { setNovastarBrightness } from './novastarsSlice';
import { selectLastAverage } from './sensorsSlice';
import debugFactory from '../util/debug';

const debug = debugFactory('gmib:initializeDevices');

const BRIGHTNESS_INTERVAL = 60 * 1000;

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

const getHostParams = (screen: Input) => (expr: string): HostParams | undefined => {
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

export const updateBrightness = debounce<AppThunk>((dispatch, getState) => {
  const state = getState();
  const brightness = selectBrightness(state);
  const { interval } = selectOverheatProtection(state) ?? {};
  if (brightness === undefined) return;
  const screens = selectScreens(state);
  const tasks = screens
    .filter(({ brightnessFactor }) => brightnessFactor && brightnessFactor > 0)
    .reduce<[DeviceId, number][]>((res, { brightnessFactor, addresses, id: screenId }) => {
      if (!addresses) return res;
      const { timestamp, screens: scr } = localConfig.get('health');
      const isValid = timestamp && interval && Date.now() - timestamp < 2 * interval * MINUTE;
      const actualBrightness = Math.min(Math.round(brightnessFactor! * brightness), 100);
      return [
        ...res,
        ...addresses
          .map(location => parseLocation(location)?.address)
          .filter(notEmpty)
          .reduce<DeviceState[]>(
            (devs, address) => [...devs, ...selectDevicesByAddress(state, address)],
            []
          )
          .map(({ id }) =>
            tuplify(
              id,
              isValid
                ? Math.min(
                    actualBrightness,
                    scr?.[screenId]?.maxBrightness ?? Number.MAX_SAFE_INTEGER
                  )
                : actualBrightness
            )
          ),
      ];
    }, []);
  tasks.forEach(([id, value]) => dispatch(setDeviceValue(id)('brightness', value)));
}, 500);

export const setCurrentBrightness = (value: number): AppThunk => dispatch => {
  dispatch(setBrightness(value));
  dispatch(setNovastarBrightness(value));
  dispatch(updateBrightness);
};

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
          maxBrightness
        );
      } else brightness = minBrightness;
    }
  }
  dispatch(setCurrentBrightness(brightness));
};

export const loadConfig = (config: Config): AppThunk => async dispatch => {
  const data = convertCfgFrom(config);
  if (!validateConfig(data)) console.error('Invalid configuration data received');
  dispatch(updateConfig(data));
  dispatch(updateBrightness);
};

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
            const devices = selectDevicesByAddress(state, target);
            devices
              .filter(notEmpty)
              // .filter(({ mib }) => mib.startsWith('minihost'))
              .forEach(({ id, address: devAddress, mib }) => {
                debug(`initialize ${devAddress}`);
                const setValue = setDeviceValue(id);
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
                  value !== undefined && value !== null && dispatch(setValue(name, value));
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

let brightnessTimer = 0;

export const initializeConfig: AsyncInitializer = dispatch => {
  if (!isRemoteSession && !brightnessTimer) {
    brightnessTimer = window.setInterval(() => dispatch(calculateBrightness), BRIGHTNESS_INTERVAL);
  }
};
