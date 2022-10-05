// import debugFactory from 'debug';
import { createAsyncThunk } from '@reduxjs/toolkit';

import type { DeviceId } from '@nibus/core';
import Address, { AddressType } from '@nibus/core/Address';
import { MCDVI_TYPE, MINIHOST_TYPE } from '@nibus/core/common';

import screenApi, { selectScreens, updateMinihosts } from '../api/screens';

import { setCurrentTab } from './currentSlice';
import { addDevice, setConnected } from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  filterDevicesByAddress,
  selectAllDevices,
  selectCurrentDeviceId,
  selectDevicesByAddress,
  // selectScreenAddresses,
} from './selectors';
import { setOnline } from './sessionSlice';

import type { AppThunk, AppThunkConfig } from './index';

import { isRemoteSession } from '/@common/remote';
import { asyncSerial, delay } from '/@common/helpers';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);
const PING_INTERVAL = 10000;

let pingTimer = 0;

// eslint-disable-next-line import/prefer-default-export
export const reloadDevice = createAsyncThunk<Promise<void>, DeviceId, AppThunkConfig>(
  'devices/reload',
  id => window.nibus.reloadDevice(id),
);

const isSlaveMinihostOrMcdvi = (info?: { type: number; owner?: string }): boolean =>
  Boolean(info && ((info.type === MINIHOST_TYPE && info.owner) || info.type === MCDVI_TYPE));

const selectAddresses = screenApi.endpoints.getAddresses.select();
const selectScreenData = screenApi.endpoints.getScreens.select();

const discoverScreenDevices = (): AppThunk => async (dispatch, getState) => {
  const state = getState();
  const isReady = !selectAllDevices(state).some(({ isBusy }) => isBusy);
  if (isReady) {
    const { data: screenData } = selectScreenData(state);
    const screens = screenData && selectScreens(screenData);
    const { data: addresses = [] } = selectAddresses(state);
    const deviceAddressExists = (address: string): boolean =>
      selectDevicesByAddress(getState(), address).length > 0;
    const needUpdate = new Set<number>();
    asyncSerial(addresses, async address => {
      if (!deviceAddressExists(address)) {
        const [timeout, info] = await window.nibus.ping(address);
        if (
          timeout !== -1 &&
          isSlaveMinihostOrMcdvi(info) &&
          info.owner &&
          !deviceAddressExists(address)
        ) {
          window.nibus.createDevice(info.owner, address, info.type, info.version);
          await delay(5);
          screens &&
            screens
              .filter(item => item.addresses?.includes(address))
              .forEach(item => needUpdate.add(item.id));
        }
      }
    });
    needUpdate.forEach(screenId => dispatch(updateMinihosts(screenId)));
  }
  pingTimer = window.setTimeout(
    () => dispatch(discoverScreenDevices()),
    isRemoteSession ? PING_INTERVAL * 4 : PING_INTERVAL,
  );
};

startAppListening({
  actionCreator: setConnected,
  effect: ({ payload: [id, connected] }, { dispatch }) => {
    connected && dispatch(reloadDevice(id));
  },
});

// if (!isRemoteSession) {
startAppListening({
  actionCreator: setOnline,
  effect({ payload: online }, { dispatch }) {
    if (!online) {
      window.clearTimeout(pingTimer);
      pingTimer = 0;
    } else if (!pingTimer) {
      window.setTimeout(() => dispatch(discoverScreenDevices()), PING_INTERVAL);
    }
  },
});
// }

startAppListening({
  predicate(_, currentState, previousState) {
    const current = selectCurrentDeviceId(currentState);
    return current !== undefined && current !== selectCurrentDeviceId(previousState);
  },
  effect(_, { dispatch }) {
    dispatch(setCurrentTab('devices'));
  },
});

startAppListening({
  actionCreator: addDevice,
  effect({ payload: device }, { dispatch, getState }) {
    const state = getState();
    const deviceAddress = new Address(device.address);
    if (deviceAddress.type !== AddressType.mac) return;
    const { data: addresses } = selectAddresses(state);
    if (addresses) {
      for (let i = 0; i < addresses.length; i += 1) {
        const address = addresses[i];
        const [found] = filterDevicesByAddress([device], new Address(address));
        if (found) {
          const { data: screenData } = selectScreenData(state);
          const screens = screenData ? selectScreens(screenData) : [];
          screens.forEach(item => {
            if (item.addresses?.includes(address)) dispatch(updateMinihosts(item.id));
          });
          return;
        }
      }
    }
  },
});
