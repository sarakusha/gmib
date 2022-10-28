import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch as origUseDispatch, useSelector as origUseSelector } from 'react-redux';

import type { AppThunkConfig as OriginalAppThunkConfig } from '../../common/createDebouncedAsyncThunk';
import * as api from '../api';

import authMiddleware from './authMiddleware';
import configReducer from './configSlice';
import currentReducer from './currentSlice';
import devicesReducer from './devicesSlice';
import type { DeviceState } from './devicesSlice';
import flasherReducer from './flasherSlice';
import listenerMiddleware from './listenerMiddleware';
import logReducer from './logSlice';
import mibsReducer from './mibsSlice';
// import novastarReducer from './novastarSlice';
import remoteHostsReducer from './remoteHostsSlice';
// import screensReducer from './screensSlice';
import { selectAllDevices, selectDeviceById } from './selectors';
import sensorsReducer from './sensorsSlice';
import sessionReducer from './sessionSlice';
import telemetryReducer from './telemetrySlice';

import type { DeviceId } from '@nibus/core';

import './configThunks';
import './deviceThunks';
import './healthThunks';
import './sensorThunks';
import './currentThunks';

export const store = configureStore({
  reducer: {
    current: currentReducer,
    config: configReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    sensors: sensorsReducer,
    remoteHosts: remoteHostsReducer,
    // novastar: novastarReducer,
    log: logReducer,
    flasher: flasherReducer,
    telemetry: telemetryReducer,
    // screens: screensReducer,
    ...api.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // `convertFrom` is a function
        ignoredPaths: ['mibs.entities'],
        ignoredActions: ['mibs/addMib'],
      },
    })
      .prepend(listenerMiddleware.middleware)
      .concat(...api.middleware, authMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  Action<string>
>;
export type AppDispatch = typeof store.dispatch;
export type AppThunkConfig = OriginalAppThunkConfig<RootState, AppDispatch>;

export const useDispatch = (): AppDispatch => origUseDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

export const useDevices = (): DeviceState[] => useSelector(selectAllDevices);
export const useDevice = (id?: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id ?? ''));
