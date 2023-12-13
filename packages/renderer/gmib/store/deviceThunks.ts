// import debugFactory from 'debug';
import { createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';

import { reAddress } from '/@common/config';

import screenApi, { selectScreens, updateMinihosts } from '../api/screens';

import type { DeviceId } from '@nibus/core';
import Address, { AddressType } from '@nibus/core/Address';
import { MCDVI_TYPE, MINIHOST_TYPE } from '@nibus/core/common';

import { setCurrentDevice, setCurrentTab } from './currentSlice';
import {
  addDevice,
  connectionClosed,
  removeDevice,
  setConnected,
  updateProperty,
  updateProps,
} from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  filterDevicesByAddress,
  selectAllDevices,
  selectAutobrightness,
  selectCurrentDeviceId,
  selectDeviceById,
  selectDeviceIds,
  selectDevicesByAddress,
  selectLinks,
  // selectScreenAddresses,
} from './selectors';
import { addDetected, setOnline } from './sessionSlice';

import type { AppThunk, AppThunkConfig } from '.';

import { isRemoteSession } from '/@common/remote';
import type { FinderOptions } from '/@common/helpers';
import { asyncSerial, delay } from '/@common/helpers';
import { setAutobrightness } from './configSlice';

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
      selectDevicesByAddress(state, address).length > 0;
    const needUpdate = new Set<number>();
    await asyncSerial(addresses, async address => {
      if (reAddress.test(address) && !deviceAddressExists(address)) {
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

const nibusNetAddressProps = ['domain', 'subnet', 'did'];

startAppListening({
  matcher: isAnyOf(updateProps, updateProperty),
  async effect(action, { dispatch, getState }) {
    const [deviceId, propsOrName] = updateProps.match(action) || updateProperty.match(action) ? action.payload : [];
    if (!deviceId || !propsOrName) return;
    const addressChanged =
      typeof propsOrName === 'string'
        ? nibusNetAddressProps.includes(propsOrName)
        : nibusNetAddressProps.some(name => propsOrName[name] !== undefined);
    if (!addressChanged) return;
    const state = getState();
    const device = selectDeviceById(state, deviceId);
    if (!device) return;
    const deviceAddress = new Address(device.address);
    if (deviceAddress.type !== AddressType.mac) return;
    let { data: addresses } = selectAddresses(state);
    if (addresses == null) {
      addresses = (await dispatch(screenApi.endpoints.getAddresses.initiate())).data;
    }
    if (addresses) {
      for (let i = 0; i < addresses.length; i += 1) {
        const address = addresses[i];
        if (reAddress.test(address)) {
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
    }
  },
});

startAppListening({
  matcher: isAnyOf(removeDevice, connectionClosed),
  effect: (_, { dispatch, getState }) => {
    const state = getState();
    const id = selectCurrentDeviceId(state);
    if (id) {
      const ids = selectDeviceIds(state);
      if (!ids.includes(id)) dispatch(setCurrentDevice());
    }
  },
});

// if (!isRemoteSession) {
  const TILUX_TYPE = 0x0043;
  const waitTilux = new Set<DeviceId>();
  startAppListening({
    actionCreator: addDevice,
    effect: ({ payload: { mib, id } }, { getState }) => {
      if (mib.startsWith('siolynx')) {
        const autoBrightness = selectAutobrightness(getState());
        if (autoBrightness) {
          const options: FinderOptions = {
            owners: [id],
            type: TILUX_TYPE,
          };
          setTimeout(() => {
            waitTilux.add(id);
            window.nibus.findDevices(options).then(() => {
              waitTilux.delete(id);
            });
          }, 10000);
        }
      }
    },
  });

  startAppListening({
    actionCreator: setAutobrightness,
    effect: ({ payload: autoBrightness }, { getState }) => {
      if (autoBrightness) {
        const owners = selectLinks(getState())
          .filter(({ mib }) => mib.startsWith('siolynx'))
          .map(({ id }) => id);
        owners.forEach(id => waitTilux.add(id));
        const options: FinderOptions = {
          owners,
          type: TILUX_TYPE,
        };
        window.nibus.findDevices(options).then(() => {
          owners.forEach(id => waitTilux.delete(id));
        });
      }
    },
  });

  startAppListening({
    actionCreator: addDetected,
    effect: ({ payload }, { getState }) => {
      if (
        waitTilux &&
        payload.owner &&
        payload.type === TILUX_TYPE &&
        waitTilux.has(payload.owner)
      ) {
        const devices = selectDevicesByAddress(getState(), payload.address);
        if (devices.length === 0) {
          window.nibus.createDevice(payload.owner, payload.address, 'ti_lux_2_3');
        }
      }
    },
  });
// }
