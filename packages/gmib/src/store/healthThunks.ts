/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Address, asyncSerialMap, DeviceId } from '@nibus/core';
import { ipcRenderer } from 'electron';
import intersection from 'lodash/intersection';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import { OverheatProtection } from '../util/config';
import { isRemoteSession } from '../util/nibus';
import { MINUTE, notEmpty, PropPayload } from '../util/helpers';
import localConfig, { Aggregations } from '../util/localConfig';
import Minihost2Loader, { Minihost2Info } from '../util/Minihost2Loader';
import Minihost3Loader, { Minihost3Info, Minihost3Selector } from '../util/Minihost3Loader';
import MinihostLoader from '../util/MinihostLoader';
import { AsyncInitializer } from './asyncInitialMiddleware';
import {
  selectBrightness,
  selectOverheatProtection,
  selectScreenById,
  selectScreens,
  setProtectionPropImpl,
} from './configSlice';
import { updateBrightness } from './configThunks';
import {
  deviceBusy,
  DeviceProps,
  deviceReady,
  DeviceState,
  filterDevicesByAddress,
  selectAllDevices,
  selectDeviceById,
  ValueType,
} from './devicesSlice';
import debugFactory from '../util/debug';
import type { RootState, AppThunk } from './index';

const debug = debugFactory('gmib:health');

type SaveTelemetry = (x: number, y: number, temperature: number) => void;

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

const startTelemetry = (address: string): SaveTelemetry => {
  const timestamp = Date.now();
  return (x, y, temperature) => {
    ipcRenderer.send('addTelemetry', timestamp, address, x, y, temperature);
  };
};

const updateMaxBrightness = (
  id: string,
  aggregations: Aggregations,
  desiredBrightness: number
): AppThunk => (dispatch, getState) => {
  const health = localConfig.get('health') ?? {};
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
  localConfig.set('health', health);
};

type GroupedByScreens = {
  screens: string[];
  devices: DeviceId[];
};

const groupDevicesByScreens = (state: RootState): GroupedByScreens[] => {
  const screens = selectScreens(state);
  const allDevices = selectAllDevices(state);
  const series = screens
    .filter(({ addresses }) => addresses !== undefined && addresses.length > 0)
    .map(({ id, addresses }) => ({
      screens: [id],
      devices: flatten(
        addresses!.map(address =>
          filterDevicesByAddress(allDevices, new Address(address)).map(
            ({ id: deviceId }) => deviceId
          )
        )
      ),
    }))
    .filter(({ devices }) => devices.length > 0);
  const groupedByScreens: GroupedByScreens[] = [];
  /*
  If there is an overlap of devices, we combine the groups
   */
  while (series.length > 0) {
    const [item] = series.splice(0, 1);
    const container = series.find(
      ({ devices }) => intersection([item.devices, devices]).length > 0
    );
    if (!container) {
      groupedByScreens.push(item);
    } else {
      container.screens.push(...item.screens);
      container.devices = [...new Set([...container.devices, ...item.devices])];
      debug(
        `WARNING: screens ${container.screens
          .map(screenId => selectScreenById(state, screenId))
          .filter(notEmpty)
          .map(({ name }) => name)
          .join(', ')} refer to the same device addresses`
      );
    }
  }
  return groupedByScreens;
};

const groupDevicesByConnection = (devices: DeviceState[]): DeviceState[][] =>
  Object.values(groupBy(devices, 'path'));

const getValues = (props: DeviceProps): Record<string, ValueType> =>
  Object.fromEntries(Object.entries(props).map(([name, state]) => [name, state.value]));

const checkDevice = ({ id, mib, props, address }: DeviceState): Promise<number[]> =>
  new Promise<number[]>(resolve => {
    const results: number[] = [];
    let loader: MinihostLoader<Minihost2Info | Minihost3Info> | undefined;
    if (mib.startsWith('minihost')) {
      loader = new Minihost3Loader(id);
    } else if (mib === 'mcdvi') {
      loader = new Minihost2Loader(id);
    }
    if (!loader) {
      resolve(results);
      return;
    }
    const values = getValues(props);
    const {
      hres = 0,
      vres = 0,
      moduleHres = 0,
      moduleVres = 0,
      maxModulesH = 24,
      maxModulesV = 32,
    } = values as Record<string, number>;
    // console.log({ hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV });
    if (!hres || !vres || !moduleHres || !moduleVres) {
      resolve(results);
      return;
    }
    debug(`start telemetry: ${address}`);
    const saver = startTelemetry(address);
    loader.on('column', column => {
      column.forEach(module => {
        const { t } = module.info ?? {};
        if (t !== undefined) {
          saver(module.x, module.y, t);
          results.push(t);
        }
      });
    });
    loader.on('finish', () => {
      debug(`${address} is finished`);
      loader?.removeAllListeners();
      resolve(results);
    });
    const xMax = Math.min(Math.ceil(hres / moduleHres), maxModulesH || 24) - 1;
    const yMax = Math.min(Math.ceil(vres / moduleVres), maxModulesV || 32) - 1;
    loader.run({
      xMin: 0,
      xMax,
      yMin: 0,
      yMax,
      selectors: [Minihost3Selector.Temperature],
    });
  });

const checkTemperature = (): AppThunk<Promise<void>> => async (
  dispatch,
  getState
): Promise<void> => {
  if (isRemoteSession) throw new Error('Only local session');
  const state = getState();
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
  await Promise.all(
    groups.map(
      async ({ screens, devices }): Promise<void> => {
        const results = flatten(
          await Promise.all(
            groupDevicesByConnection(
              devices
                .map(deviceId => selectDeviceById(state, deviceId))
                .filter(notEmpty)
                .filter(({ connected }) => connected)
            ).map(groupedByConnection =>
              asyncSerialMap(groupedByConnection, async device => {
                dispatch(deviceBusy(device.id));
                const temperatures = await checkDevice(device);
                dispatch(deviceReady(device.id));
                return temperatures;
              })
            )
          )
        ).filter(notEmpty);
        if (results.length === 0) {
          const health = localConfig.get('health');
          if (health) {
            screens.forEach(name => delete health.screens[name]);
          }
          localConfig.set('health', health);
          return;
        }
        const sorted = results.sort();
        const maximum = sorted[sorted.length - 1];
        const average = calcAverage(sorted);
        const median = calcMedian(sorted);
        const { brightnessFactor = 1 } = selectScreenById(state, screens[0]) ?? {};
        screens.forEach(id => {
          dispatch(
            updateMaxBrightness(
              id,
              [maximum, average, median],
              Math.max(Math.min(desiredBrightness * brightnessFactor, 100), 0)
            )
          );
        });
      }
    )
  );
  const existingScreens = flatten(groups.map(({ screens }) => screens));
  const health = localConfig.get('health');
  Object.keys(health.screens).forEach(id => {
    existingScreens.includes(id) || delete health.screens[id];
  });
  health.timestamp = Date.now();
  localConfig.set('health', health);
  dispatch(updateBrightness);

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

const setProtectionProp = (payload: PropPayload<OverheatProtection>): AppThunk => dispatch => {
  dispatch(setProtectionPropImpl(payload));
  if (isRemoteSession) return;
  const [name] = payload;
  if (name === 'enabled' || name === 'interval') {
    dispatch(updateOverheatProtection());
  }
};

export const healthInitializer: AsyncInitializer = dispatch => {
  if (isRemoteSession) return;
  setTimeout(() => dispatch(updateOverheatProtection()), 1000);
};

export default setProtectionProp;
