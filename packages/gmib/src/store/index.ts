/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { DeviceId } from '@nibus/core';
import { Action, Middleware, ThunkAction, configureStore } from '@reduxjs/toolkit';
import { BaseThunkAPI } from '@reduxjs/toolkit/src/createAsyncThunk';
import {
  TypedUseSelectorHook,
  useDispatch as origUseDispatch,
  useSelector as origUseSelector,
} from 'react-redux';
import asyncInitializer from './asyncInitialMiddleware';
import currentReducer from './currentSlice';
import configReducer from './configSlice';
import { initializeConfig } from './configThunks';
import { initializeDevices } from './deviceThunks';
import healthInitializer from './healthThunks';
import sessionReducer, { openSession } from './sessionSlice';
import devicesReducer, { DeviceState, selectAllDevices, selectDeviceById } from './devicesSlice';
import mibsReducer from './mibsSlice';
import nibusReducer from './nibusSlice';
import sensorsReducer from './sensorsSlice';
import remoteHostsReducer, { initializeRemoteHosts } from './remoteHostsSlice';
import novastarsReducer, { novastarInitializer } from './novastarsSlice';
import listenerMiddleware from './listenerMiddleware';

const middlewares: ReadonlyArray<Middleware> = [
  asyncInitializer(openSession),
  asyncInitializer(initializeConfig),
  asyncInitializer(initializeRemoteHosts),
  asyncInitializer(initializeDevices),
  asyncInitializer(healthInitializer),
  asyncInitializer(novastarInitializer),
];

export const store = configureStore({
  reducer: {
    current: currentReducer,
    config: configReducer,
    nibus: nibusReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    sensors: sensorsReducer,
    remoteHosts: remoteHostsReducer,
    novastars: novastarsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // `convertFrom` is a function
        ignoredPaths: ['mibs.entities'],
        // ignoredActionPaths: ['payload.release'],
      },
    })
      .prepend(listenerMiddleware.middleware)
      .concat(...middlewares),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  Action<string>
>;
export type AppDispatch = typeof store.dispatch;
export type AppThunkConfig = {
  dispatch: AppDispatch;
  state: RootState;
  extra?: unknown;
  rejectValue?: unknown;
  serializedErrorType?: unknown;
  pendingMeta?: unknown;
  fulfilledMeta?: unknown;
  rejectedMeta?: unknown;
};
export type AppThunkAPI = BaseThunkAPI<RootState, unknown, AppDispatch>;

export const useDispatch = (): AppDispatch => origUseDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

export const useDevices = (): DeviceState[] => useSelector(selectAllDevices);
export const useDevice = (id?: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id ?? ''));
