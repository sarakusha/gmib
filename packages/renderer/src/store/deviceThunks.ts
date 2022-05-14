import type { DeviceId } from '@nibus/core';
import { MCDVI_TYPE, MINIHOST_TYPE } from '@nibus/core/lib/common';

import { tuplify } from '/@common/helpers';

import { createAsyncThunk } from '@reduxjs/toolkit';

import { setCurrentTab } from './currentSlice';
import { setConnected } from './devicesSlice';
import { startAppListening } from './listenerMiddleware';
import {
  selectAllDevices,
  selectCurrentDeviceId,
  selectDevicesByAddress,
  selectScreenAddresses,
} from './selectors';
import { setOnline } from './sessionSlice';

import { isRemoteSession } from '/@common/remote';

import type { AppThunk, AppThunkConfig } from './index';

const PING_INTERVAL = 10000;

export const reloadDevice = createAsyncThunk<Promise<void>, DeviceId, AppThunkConfig>(
  'devices/reload',
  id => window.nibus.reloadDevice(id),
);

const isSlaveMinihostOrMcdvi = (info?: { type: number; owner?: string }): boolean =>
  Boolean(info && ((info.type === MINIHOST_TYPE && info.owner) || info.type === MCDVI_TYPE));

export const ping = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const isReady = !selectAllDevices(state).some(({ isBusy }) => isBusy);
  if (!isReady) {
    window.setTimeout(() => dispatch(ping()), 300);
    return;
  }
  const inaccessibleAddresses = selectScreenAddresses(state).filter(
    address => selectDevicesByAddress(state, address).length === 0,
  );
  if (inaccessibleAddresses.length === 0) return;
  Promise.all(
    inaccessibleAddresses.map(async address => tuplify(await window.nibus.ping(address), address)),
  ).then(res =>
    res
      .filter(([[timeout, info]]) => timeout > 0 && isSlaveMinihostOrMcdvi(info))
      .forEach(([[, info], address]) => {
        // debug(`source: ${info?.source}`);
        info.owner && window.nibus.createDevice(info.owner, address, info.type, info.version);
      }),
  );
};

startAppListening({
  actionCreator: setConnected,
  effect: ({ payload: [id, connected] }, { dispatch }) => {
    connected && dispatch(reloadDevice(id));
  },
});

let pingTimer = 0;

if (!isRemoteSession) {
  startAppListening({
    actionCreator: setOnline,
    effect({ payload: online }, { dispatch }) {
      if (!online) {
        window.clearInterval(pingTimer);
        pingTimer = 0;
      } else if (!pingTimer) {
        pingTimer = window.setInterval(() => dispatch(ping()), PING_INTERVAL);
      }
    },
  });
}

startAppListening({
  predicate(_, currentState, previousState) {
    const current = selectCurrentDeviceId(currentState);
    return current !== undefined && current !== selectCurrentDeviceId(previousState);
  },
  effect(_, { dispatch }) {
    dispatch(setCurrentTab('devices'));
  },
});
