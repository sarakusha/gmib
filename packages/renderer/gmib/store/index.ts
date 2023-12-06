import type { DeviceId } from '@nibus/core';
import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { combineSlices, configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch as origUseDispatch, useSelector as origUseSelector } from 'react-redux';

import type { AppThunkConfig as OriginalAppThunkConfig } from '../../common/createDebouncedAsyncThunk';
import * as api from '../api';

import authMiddleware from './authMiddleware';
import configSlice from './configSlice';
import currentSlice from './currentSlice';
import devicesSlice from './devicesSlice';
import type { DeviceState } from './devicesSlice';
import flasherSlice from './flasherSlice';
import listenerMiddleware from './listenerMiddleware';
import logSlice from './logSlice';
import mibsSlice from './mibsSlice';
// import novastarReducer from './novastarSlice';
import remoteHostsSlice from './remoteHostsSlice';
// import screensReducer from './screensSlice';
import { selectAllDevices, selectDeviceById } from './selectors';
import sensorsSlice from './sensorsSlice';
import sessionSlice from './sessionSlice';
import telemetrySlice from './telemetrySlice';

import './configThunks';
import './deviceThunks';
import './healthThunks';
import './sensorThunks';
import './currentThunks';
import { setupListeners } from '@reduxjs/toolkit/query';

export const store = configureStore({
  reducer: combineSlices(
    currentSlice,
    configSlice,
    sessionSlice,
    devicesSlice,
    mibsSlice,
    sensorsSlice,
    remoteHostsSlice,
    logSlice,
    flasherSlice,
    telemetrySlice,
    api.reducer,
  ),
  middleware: gDM =>
    gDM({
      serializableCheck: {
        // `convertFrom` is a function
        ignoredPaths: ['mibs.entities'],
        ignoredActions: ['mibs/addMib'],
      },
    })
      .prepend(listenerMiddleware.middleware)
      .concat(...api.middleware, authMiddleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  Action<string>
>;
export type AppDispatch = typeof store.dispatch;
export type AppThunkConfig = OriginalAppThunkConfig<RootState, AppDispatch>;

export const useDispatch: () => AppDispatch = origUseDispatch;
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

export const useDevices = (): DeviceState[] => useSelector(selectAllDevices);
export const useDevice = (id?: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id ?? ''));

/**
 * Response on 'get-host-options'
 */
// window.electronAPI.handleHost(event => {
//   const state = store.getState();
//   const { name, platform, arch, version }: Partial<Host> = state.session;
//   event.sender.send('host-options', { name, platform, arch, version });
// });
