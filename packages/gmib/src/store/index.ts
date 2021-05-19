/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { DeviceId } from '@nibus/core';
import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import {
  TypedUseSelectorHook,
  useDispatch as origUseDispatch,
  useSelector as origUseSelector,
} from 'react-redux';
import asyncInitializer from './asyncInitialMiddleware';
import currentReducer from './currentSlice';
import configReducer, { initializeConfig } from './configSlice';
import sessionReducer, { openSession } from './sessionSlice';
import devicesReducer, {
  DeviceState,
  initializeDevices,
  selectAllDevices,
  selectDeviceById,
} from './devicesSlice';
import mibsReducer from './mibsSlice';
import nibusReducer from './nibusSlice';
import sensorsReducer from './sensorsSlice';
import remoteHostsReducer, { initializeRemoteHosts } from './remoteHostsSlice';
import novastarsReducer from './novastarsSlice';

export const store = configureStore({
  reducer: {
    current: currentReducer,
    config: configReducer,
    nibus: nibusReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    // tests: testsReducer,
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
    }).concat(
      // asyncInitializer(loadTests),
      asyncInitializer(openSession),
      asyncInitializer(initializeConfig),
      asyncInitializer(initializeRemoteHosts),
      asyncInitializer(initializeDevices)
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export type AppDispatch = typeof store.dispatch;
export const useDispatch = (): AppDispatch => origUseDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

export const useDevices = (): DeviceState[] => useSelector(selectAllDevices);
export const useDevice = (id?: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id ?? ''));
