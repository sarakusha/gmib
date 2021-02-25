/* eslint-disable no-bitwise */
/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';
import session, { NibusSessionEvents } from '@nibus/core';
import sortBy from 'lodash/sortBy';
import maxBy from 'lodash/maxBy';
import { notEmpty } from '../util/helpers';
import type { AsyncInitializer } from './asyncInitialMiddleware';
import type { AppThunk, RootState } from './index';
// import config, { Altitude, HistoryItem } from '../util/config';
// import { selectLocation } from './locationSlice';

type SensorRecord = [timestamp: number, value: number];

type SensorAddress = string;

type SensorState = {
  current: SensorRecord | undefined;
  average: number | undefined;
  history: SensorRecord[];
};

const DEFAULT_INTERVAL = 60;
const MIN_INTERVAL = 10;
const ILLUMINATION = 321;
const TEMPERATURE = 128;

type SensorDictionary = Record<SensorAddress, SensorState>;

type SensorKind = 'temperature' | 'illuminance';

interface SensorsState {
  /**
   * interval in seconds
   */
  interval: number;
  sensors: Record<SensorKind, SensorDictionary>;
}

const initialState: SensorsState = {
  interval: DEFAULT_INTERVAL,
  sensors: {
    illuminance: {},
    temperature: {},
  },
};

type SensorValue = [address: SensorAddress, value: number];

const calculateSensors = (sensors: Draft<SensorDictionary>, interval): void => {
  Object.entries(sensors).forEach(([, sensorState]) => {
    let { history } = sensorState;
    const { current } = sensorState;
    const startingFrom = Date.now() - interval * 1000;
    history = sortBy(
      history.filter(([timestamp]) => timestamp >= startingFrom),
      ([timestamp]) => timestamp
    );
    sensorState.history = history;
    if (current && Date.now() - current[0] > (MIN_INTERVAL + 1) * 1000)
      sensorState.current = undefined;

    if (history.length === 0) {
      sensorState.average = sensorState.current?.[1];
    } else {
      const total = [...history];
      current && total.push(current);
      const half = total.length >>> 1;
      if (total.length % 2 === 1) {
        [, sensorState.average] = total[half];
      } else {
        const [, left] = total[half - 1];
        const [, right] = total[half];
        sensorState.average = Math.round((left + right) / 2);
      }
    }
  });
};

const pushValue = (sensors: Draft<SensorDictionary>, [address, value]: SensorValue): void => {
  const sensor = sensors[address];
  const current: SensorRecord = [Date.now(), value];
  if (!sensor) {
    sensors[address] = {
      current,
      average: value,
      history: [],
    };
  } else {
    if (sensor.current) {
      sensor.history = [...sensor.history, sensor.current];
    }
    sensor.current = current;
  }
};

const sensorsSlice = createSlice({
  name: 'sensor',
  initialState,
  reducers: {
    changeInterval(state, { payload: interval }: PayloadAction<number>) {
      state.interval = Math.max(interval, MIN_INTERVAL);
    },
    push(state, { payload: [kind, value] }: PayloadAction<[kind: SensorKind, value: SensorValue]>) {
      pushValue(state.sensors[kind], value);
    },
    calculate(state) {
      Object.values(state.sensors).forEach(dic => calculateSensors(dic, state.interval));
    },
  },
});

const { changeInterval, push, calculate } = sensorsSlice.actions;

export const setInterval = (interval: number): AppThunk => dispatch => {
  dispatch(changeInterval(interval));
  dispatch(calculate());
};

let timeout = 0;

export const pushSensorValue = (
  kind: SensorKind,
  address: string,
  value: number
): AppThunk => dispatch => {
  window.clearTimeout(timeout);
  const sensorValue: SensorValue = [address, value];
  dispatch(push([kind, sensorValue]));
  dispatch(calculate());
  // if (kind === 'illuminance') {
  //   const { longitude, latitude } = selectLocation(getState());
  //   if (longitude !== undefined && latitude !== undefined) {
  //     const { altitude } = SunCalc.getPosition(new Date(), latitude, longitude);
  //     const degree = Math.round((altitude * 180) / Math.PI);
  //     const prop = `${degree}` as Altitude;
  //     const history = config.get('history') ?? {};
  //     const [average, count]: HistoryItem = history[prop] ?? [];
  //     history[prop] =
  //       average !== undefined && count !== undefined && count > 0
  //         ? [average + (value - average) / (count + 1), Math.min(count + 1, 100)]
  //         : [value, 1];
  //     config.set('history', history);
  //   }
  // }
  timeout = window.setTimeout(() => dispatch(calculate()), (MIN_INTERVAL + 1) * 1000);
};

export const startSensorListener: AsyncInitializer = dispatch => {
  const informationListener: NibusSessionEvents['informationReport'] = (
    connection,
    { id, value, source }
  ) => {
    switch (id) {
      case ILLUMINATION:
        dispatch(pushSensorValue('illuminance', source.toString(), value));
        break;
      case TEMPERATURE:
        dispatch(pushSensorValue('temperature', source.toString(), value));
        break;
      default:
        break;
    }
  };

  // const closeListener = (): void => {
  //   console.log('CLOSE SESSION');
  //   session.off('close', closeListener);
  //   session.off('informationReport', informationListener);
  // };
  //
  // session.on('close', closeListener);
  session.on('informationReport', informationListener);
};

const selectLast = (state: RootState, kind: SensorKind): SensorState | undefined => {
  const sensors = state.sensors.sensors[kind];
  return maxBy(
    Object.values(sensors).filter(({ current }) => notEmpty(current)),
    ({ current }) => current![0]
  );
};

const selectLastValue = (state: RootState, kind: SensorKind): number | undefined => {
  const [, max] = selectLast(state, kind)?.current ?? [];
  return max;
  // const sensors = state.sensors.sensors[kind];
  // const [, max] =
  //   maxBy(
  //     Object.values(sensors)
  //       .map(({ current }) => current)
  //       .filter(notEmpty),
  //     ([timestamp]) => timestamp
  //   ) ?? [];
  // return max;
};

export const selectLastAverage = (state: RootState, kind: SensorKind): number | undefined =>
  selectLast(state, kind)?.average;

export const selectIlluminance = (state: RootState): SensorDictionary =>
  state.sensors.sensors.illuminance;

export const selectLastIlluminance = (state: RootState): number | undefined =>
  selectLastValue(state, 'illuminance');

export const selectCurrentIlluminance = (state: RootState, address: string): number | undefined =>
  selectIlluminance(state).sensors[address]?.current?.[1];

export const selectTemperature = (state: RootState): SensorDictionary =>
  state.sensors.sensors.temperature;

export const selectLastTemperature = (state: RootState): number | undefined =>
  selectLastValue(state, 'temperature');

export const selectCurrentTemperature = (state: RootState, address: string): number | undefined =>
  selectTemperature(state).sensors[address]?.current?.[1];

export default sensorsSlice.reducer;
