/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  Address,
  DeviceId,
  IDevice,
  INibusSession,
  MCDVI_TYPE,
  MINIHOST_TYPE,
  VersionInfo,
} from '@nibus/core';
import { toErrorMessage, tuplify } from '../util/helpers';
import { getCurrentNibusSession, isRemoteSession } from '../util/nibus';
import { AsyncInitializer } from './asyncInitialMiddleware';
import { selectBrightness, selectScreenAddresses } from './configSlice';
import {
  addDevice,
  changeAddress,
  deviceReady,
  reloadDevice,
  removeDevice,
  selectAllDevices,
  selectDevicesByAddress,
  setConnected,
  setDeviceValue,
  setParent,
  updateProps,
} from './devicesSlice';
import type { AppThunk } from './index';
import { updateScreen } from './configThunks';
import { addMib } from './mibsSlice';

const PINGER_INTERVAL = 10000;

const isSlaveMinihostOrMcdvi = (info?: VersionInfo): boolean =>
  Boolean(
    info && ((info.type === MINIHOST_TYPE && info.connection.owner) || info.type === MCDVI_TYPE)
  );

export const createDevice = (
  parent: DeviceId,
  address: string,
  type: number,
  version?: number
): AppThunk => dispatch => {
  const session = getCurrentNibusSession();
  const device = session.devices.create(address, type!, version);
  const parentDevice = session.devices.findById(parent);
  if (parentDevice) {
    device.connection = parentDevice.connection;
    const checkConnection = async (): Promise<void> => {
      await session.pingDevice(device);
    };
    const timer = window.setInterval(checkConnection, 10000);
    device.once('release', () => window.clearInterval(timer));
  }
  setImmediate(() => {
    dispatch(setParent([device.id, parent]));
  });
};

const pinger = (session: INibusSession): AppThunk => (dispatch, getState) => {
  const state = getState();
  const isReady = !selectAllDevices(state).some(({ isBusy }) => isBusy);
  if (!isReady) {
    window.setTimeout(() => dispatch(pinger(session)), 300);
    return;
  }
  const inaccessibleAddresses = selectScreenAddresses(state).filter(
    address => selectDevicesByAddress(state, address).length === 0
  );
  if (inaccessibleAddresses.length === 0) return;
  Promise.all(
    inaccessibleAddresses.map(async address => tuplify(await session.ping(address), address))
  ).then(res =>
    res
      .filter(([[timeout, info]]) => timeout > 0 && isSlaveMinihostOrMcdvi(info))
      .forEach(([[, info], address]) => {
        // debug(`source: ${info?.source}`);
        dispatch(createDevice(info!.connection.owner!.id, address, info!.type, info!.version));
      })
  );
};

let pingerTimer = 0;

export const initializeDevices: AsyncInitializer = (dispatch, getState) => {
  if (!isRemoteSession && !pingerTimer) {
    const session = getCurrentNibusSession();
    pingerTimer = window.setInterval(() => dispatch(pinger(session)), PINGER_INTERVAL);
  }
  const newDeviceHandler = (device: IDevice): void => {
    const { id: deviceId } = device;
    const mib = Reflect.getMetadata('mib', device);
    const connectedHandler = (): void => {
      dispatch(setConnected(deviceId));
      dispatch(reloadDevice(deviceId));
    };
    const disconnectedHandler = (): void => {
      /*
      try {
        const current = selectCurrentDeviceId(getState());
        if (current === deviceId) {
          dispatch(setCurrentDevice(undefined));
        }
      } catch (e) {
        console.error(`error while disconnect: ${e.message}`);
      }
*/
      device.release();
    };
    const addressHandler = (prev: Address, address: Address): void => {
      dispatch(changeAddress([deviceId, address.toString()]));
    };
    const releaseHandler = (): void => {
      device.off('connected', connectedHandler);
      device.off('disconnected', disconnectedHandler);
      device.off('release', releaseHandler);
      device.off('addressChanged', addressHandler);
    };
    device.on('connected', connectedHandler);
    device.on('disconnected', disconnectedHandler);
    device.on('release', releaseHandler);
    device.on('addressChanged', addressHandler);

    dispatch(addMib(deviceId));
    // isBusy = 1
    dispatch(addDevice(deviceId));
    setTimeout(() => {
      if (!device.connection) return;
      device.read().finally(() => {
        dispatch(updateProps([deviceId]));
        dispatch(deviceReady(deviceId));
        // debug(`deviceReady ${device.address.toString()}`);
        // selectCurrentDeviceId(getState()) || dispatch(setCurrentDevice(deviceId));
        const brightness = selectBrightness(getState());
        const setValue = setDeviceValue(deviceId);
        if (mib?.startsWith('minihost') || mib === 'mcdvi') {
          setValue('brightness', brightness);
        }
        dispatch(updateScreen());
      });
    }, 3000);
  };
  const deleteDeviceHandler = (device: IDevice): void => {
    try {
      /*
      const current = selectCurrentDeviceId(getState());
      if (current === device.id) {
        dispatch(setCurrentDevice(undefined));
      }
*/
      dispatch(removeDevice(device.id));
    } catch (e) {
      console.error(toErrorMessage(e));
    }
  };
  const session = getCurrentNibusSession();
  session.devices.on('new', newDeviceHandler);
  session.devices.on('delete', deleteDeviceHandler);
  return () => {
    session.devices.off('new', newDeviceHandler);
    session.devices.off('delete', deleteDeviceHandler);
  };
};
