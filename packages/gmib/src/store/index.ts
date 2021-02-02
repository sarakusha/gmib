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
import asyncLoader from './asyncInitialMiddleware';
import currentReducer from './currentSlice';
import devicesReducer, {
  DeviceId,
  DeviceState,
  selectAllDevices,
  selectDeviceById,
} from './devicesSlice';
import mibsReducer from './mibsSlice';
import sessionReducer, { nibusStart } from './sessionSlice';
import testReducer, { testsLoader } from './testSlice';

export const store = configureStore({
  reducer: {
    current: currentReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    test: testReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ['mibs.entities'],
      },
    }).concat(asyncLoader(testsLoader()), asyncLoader(nibusStart())),
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
