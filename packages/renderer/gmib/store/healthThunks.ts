import debugFactory from 'debug';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import intersection from 'lodash/intersection';

import type { Aggregations } from '/@common/helpers';
import { Minihost3Selector, minmax, MINUTE, notEmpty } from '/@common/helpers';
import { isRemoteSession } from '/@common/remote';

import screenApi, { selectScreen, selectScreens } from '../api/screens';

import { setProtectionProp } from './configSlice';
import { updateBrightness } from './configThunks';
import type { DeviceState } from './devicesSlice';
import { deviceBusy, deviceReady } from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  filterDevicesByAddress,
  selectAllDevices,
  selectBrightness,
  selectDeviceById,
  selectOverheatProtection,
} from './selectors';

import type { AppThunk, RootState } from './index';

import type { DeviceId } from '@nibus/core';
import Address from '@nibus/core/Address';
import { series as pMap } from '@novastar/codec/helper';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:health`);

let running = false;
let currentInterval: number | undefined;
let monitorTimeout: number | undefined;

const calcAverage = (values: Iterable<number>): number => {
  let count = 0;
  let avg = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const value of values) {
    count += 1;
    avg += (value - avg) / count;
  }
  return Math.round(avg);
};

const calcMedian = (sorted: number[]): number => {
  if (sorted.length === 0) return 0;

  const half = Math.floor(sorted.length / 2);

  if (sorted.length % 2) return sorted[half];

  return Math.round((sorted[half - 1] + sorted[half]) / 2);
};

const updateMaxBrightness =
  (id: number, aggregations: Aggregations, desiredBrightness: number): AppThunk =>
  async (dispatch, getState) => {
    const health = (await window.config.get('health')) ?? {};
    if (!health.screens) {
      health.screens = {};
    }
    const state = getState();
    const overheatProtection = selectOverheatProtection(state);
    if (!overheatProtection) return;
    const {
      aggregations: prevAggregations = aggregations,
      maxBrightness: prevBrightness = desiredBrightness,
    } =
      !health.timestamp || Date.now() - health.timestamp >= overheatProtection.interval * 2 * MINUTE
        ? {}
        : health.screens[id] ?? {};
    let brightness = Math.min(prevBrightness, desiredBrightness);
    const max = aggregations[overheatProtection.aggregation];
    const prevMax = prevAggregations[overheatProtection.aggregation];
    if (
      max >= overheatProtection.upperBound ||
      (max >= overheatProtection.bottomBound && prevMax < max)
    ) {
      brightness -= overheatProtection.step;
    }
    health.screens[id] = {
      aggregations,
      maxBrightness: max < overheatProtection.bottomBound ? undefined : Math.max(brightness, 0),
    };
    window.config.set('health', health);
  };

type GroupedByScreens = {
  screens: number[];
  devices: DeviceId[];
};

const groupDevicesByScreens = (state: RootState): GroupedByScreens[] => {
  const { data: screensData } = screenApi.endpoints.getScreens.select()(state);
  const screens = screensData ? selectScreens(screensData) : [];
  // const screens = selectScreens(state);
  const allDevices = selectAllDevices(state);
  const series = screens
    .filter(({ addresses }) => addresses !== undefined && addresses.length > 0)
    .map(({ id, addresses = [] }) => ({
      screens: [id],
      devices: flatten(
        addresses.map(address =>
          filterDevicesByAddress(allDevices, new Address(address)).map(
            ({ id: deviceId }) => deviceId,
          ),
        ),
      ),
    }))
    .filter(({ devices }) => devices.length > 0);
  const groupedByScreens: GroupedByScreens[] = [];
  /*
  If there is an overlap of devices, we combine the groups
   */
  while (series.length > 0) {
    const item = series.shift();
    if (item === undefined) break;
    // const [item] = series.splice(0, 1);
    const container = series.find(
      ({ devices }) => intersection([item.devices, devices]).length > 0,
    );
    if (!container) {
      groupedByScreens.push(item);
    } else {
      container.screens.push(...item.screens);
      container.devices = [...new Set([...container.devices, ...item.devices])];
      debug(
        `WARNING: screens ${container.screens
          .map(screenId => screensData && selectScreen(screensData, screenId))
          .filter(notEmpty)
          .map(({ name }) => name)
          .join(', ')} refer to the same device addresses`,
      );
    }
  }
  return groupedByScreens;
};

const groupDevicesByConnection = (devices: DeviceState[]): DeviceState[][] =>
  Object.values(groupBy(devices, 'path'));

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

const checkDevice = async ({ id }: DeviceState): Promise<number[]> => {
  const res = await window.nibus
    .telemetry(id)
    .start({ selectors: [Minihost3Selector.Temperature] });
  return res.map(module => module.info?.t).filter(isNumber);
};

const checkTemperature =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState): Promise<void> => {
    if (isRemoteSession) throw new Error('Only local session');
    const state = getState();
    const { data: screensData } = screenApi.endpoints.getScreens.select()(state);
    const overheatProtection = selectOverheatProtection(state);
    if (!overheatProtection) return;
    const desiredBrightness = selectBrightness(state);
    setImmediate(() => {
      const next = new Date();
      next.setMinutes(next.getMinutes() + overheatProtection.interval);
      debug(`the next overheating check is scheduled for ${next.toLocaleString()}`);
    });
    if (running) {
      debug('screens overheating check skipped');
      return;
    }
    running = true;

    debug('screens overheating check started...');
    const groups = groupDevicesByScreens(state);
    const all = await Promise.all(
      groups.map(
        async ({ screens, devices }): Promise<{ screens: number[]; temperatures: number[] }> => {
          const results = await Promise.all(
            groupDevicesByConnection(
              devices
                .map(deviceId => selectDeviceById(state, deviceId))
                .filter(notEmpty)
                .filter(({ connected }) => connected),
            ).map(groupedByConnection =>
              pMap(groupedByConnection, async device => {
                dispatch(deviceBusy(device.id));
                const temperatures = await checkDevice(device);
                dispatch(deviceReady(device.id));
                return temperatures;
              }),
            ),
          );
          return {
            screens,
            temperatures: flatten(flatten(results)),
          };
        },
      ),
    );
    const health = await window.config.get('health');
    all.forEach(({ screens, temperatures }) => {
      if (temperatures.length === 0) {
        if (health) {
          screens.forEach(name => delete health.screens[name]);
        }
        return;
      }
      const sorted = temperatures.sort();
      const maximum = sorted[sorted.length - 1];
      const average = calcAverage(sorted);
      const median = calcMedian(sorted);
      const { brightnessFactor = 1 } = (screensData && selectScreen(screensData, screens[0])) ?? {};
      screens.forEach(id => {
        dispatch(
          updateMaxBrightness(
            id,
            [maximum, average, median],
            minmax(100, desiredBrightness * brightnessFactor),
          ),
        );
      });
    });
    const existingScreens = flatten(groups.map(({ screens }) => screens));
    // const health = window.config.get('health');
    Object.keys(health.screens).forEach(id => {
      existingScreens.includes(Number(id)) || delete health.screens[id];
    });
    health.timestamp = Date.now();
    await window.config.set('health', health);
    dispatch(updateBrightness());

    running = false;
    debug('screens overheating check completed');
  };

const updateOverheatProtection = (): AppThunk => (dispatch, getState) => {
  const { enabled = false, interval = 0 } = selectOverheatProtection(getState()) ?? {};
  if (!interval || !enabled) {
    window.clearInterval(monitorTimeout);
    debug('overheat protection disabled');
  } else if (currentInterval !== interval) {
    clearInterval(monitorTimeout);
    monitorTimeout = window.setInterval(() => dispatch(checkTemperature()), interval * MINUTE);
    // dispatch(checkTemperature());
    const next = new Date();
    next.setMinutes(next.getMinutes() + interval);
    debug(`the next overheating check is scheduled for ${next.toLocaleString()}`);
  }
  currentInterval = enabled ? interval : undefined;
};

startAppListening({
  actionCreator: setProtectionProp,
  effect({ payload: [name] }, { dispatch }) {
    if (!isRemoteSession && (name === 'enabled' || name === 'interval')) {
      dispatch(updateOverheatProtection());
    }
  },
});
