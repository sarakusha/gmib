/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import {
  TypedUseSelectorHook,
  useDispatch as origUseDispatch,
  useSelector as origUseSelector,
} from 'react-redux';
import asyncInitializer from './asyncInitialMiddleware';
import currentReducer, { initializeCurrent } from './currentSlice';
import devicesReducer, {
  DeviceId,
  DeviceState,
  selectAllDevices,
  selectDeviceById,
} from './devicesSlice';
import mibsReducer from './mibsSlice';
import sessionReducer, { startNibus } from './sessionSlice';
import testReducer, { loadTests } from './testSlice';
import sensorsReducer, { startSensorListener } from './sensorsSlice';
import locationReducer from './locationSlice';

export const store = configureStore({
  reducer: {
    current: currentReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    test: testReducer,
    sensors: sensorsReducer,
    location: locationReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ['mibs.entities'],
      },
    }).concat(
      asyncInitializer(loadTests),
      asyncInitializer(startNibus),
      asyncInitializer(startSensorListener),
      asyncInitializer(initializeCurrent)
      // asyncInitializer(updateCurrentLocation)
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
export const useDevice = (id: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id));
