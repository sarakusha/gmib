/* eslint-disable no-bitwise */
import type { Draft, PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import sortBy from 'lodash/sortBy';

export type SensorRecord = [timestamp: number, value: number];

export type SensorAddress = string;

export type SensorState = {
  current: SensorRecord | undefined;
  average: number | undefined;
  history: SensorRecord[];
};

export const DEFAULT_INTERVAL = 60;
export const MIN_INTERVAL = 30;
export const ILLUMINATION = 321;
export const TEMPERATURE = 128;

export type SensorDictionary = Record<SensorAddress, SensorState>;

const sensorKinds = ['temperature', 'illuminance'] as const;

export type SensorKind = (typeof sensorKinds)[number];

export interface SensorsState {
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

export type Sensor = {
  kind: SensorKind;
  address: SensorAddress;
  value: number;
};

const calculateSensors = (sensors: Draft<SensorDictionary>, interval: number): void => {
  const startingFrom = Date.now() - interval * 1000;
  Object.entries(sensors).forEach(([, state]) => {
    let { history } = state;
    const { current } = state;
    history = sortBy(
      history.filter(([timestamp]) => timestamp >= startingFrom),
      ([timestamp]) => timestamp,
    );
    state.history = history;
    if (current && Date.now() - current[0] > 2 * MIN_INTERVAL * 1000) state.current = undefined;

    if (history.length === 0) {
      state.average = state.current?.[1];
    } else {
      const total = [...history];
      current && total.push(current);
      const half = total.length >>> 1;
      if (total.length % 2 === 1) {
        [, state.average] = total[half];
      } else {
        const [, left] = total[half - 1];
        const [, right] = total[half];
        state.average = Math.round((left + right) / 2);
      }
    }
  });
};

const sensorsSlice = createSlice({
  name: 'sensor',
  initialState,
  reducers: {
    changeInterval(state, { payload: interval }: PayloadAction<number>) {
      state.interval = Math.max(interval, MIN_INTERVAL);
    },
    pushSensorValue(state, { payload: { kind, address, value } }: PayloadAction<Sensor>) {
      const sensors = state.sensors[kind];
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
    },
    calculate(state) {
      Object.values(state.sensors).forEach(dic => calculateSensors(dic, state.interval));
    },
  },
});

export const { changeInterval, pushSensorValue, calculate } = sensorsSlice.actions;

export default sensorsSlice.reducer;
