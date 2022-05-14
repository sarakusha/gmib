import type { DeviceId } from '@nibus/core';
import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch as origUseDispatch, useSelector as origUseSelector } from 'react-redux';

import configReducer from './configSlice';
import currentReducer from './currentSlice';
import devicesReducer from './devicesSlice';
import type { DeviceState } from './devicesSlice';
import flasherReducer from './flasherSlice';
import listenerMiddleware from './listenerMiddleware';
import logReducer from './logSlice';
import mibsReducer from './mibsSlice';
import novastarsReducer from './novastarsSlice';
import remoteHostsReducer from './remoteHostsSlice';
import { selectAllDevices, selectDeviceById } from './selectors';
import sensorsReducer from './sensorsSlice';
import sessionReducer from './sessionSlice';

import './configThunks';
import './deviceThunks';
import './healthThunks';
import './novastarThunks';

export const store = configureStore({
  reducer: {
    current: currentReducer,
    config: configReducer,
    session: sessionReducer,
    devices: devicesReducer,
    mibs: mibsReducer,
    sensors: sensorsReducer,
    remoteHosts: remoteHostsReducer,
    novastars: novastarsReducer,
    log: logReducer,
    flasher: flasherReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // `convertFrom` is a function
        ignoredPaths: ['mibs.entities'],
        ignoredActions: ['mibs/addMib'],
      },
    }).prepend(listenerMiddleware.middleware),
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

export const useDispatch = (): AppDispatch => origUseDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

export const useDevices = (): DeviceState[] => useSelector(selectAllDevices);
export const useDevice = (id?: DeviceId): DeviceState | undefined =>
  useSelector(state => selectDeviceById(state, id ?? ''));
