/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import produce from 'immer';
import debounce from 'lodash/debounce';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeviceId, useDevicesContext } from './DevicesProvier';

type DeviceState = Record<string, any>;
type StateType = Record<NonNullable<DeviceId>, DeviceState | null>;
type SetStateType = (id: NonNullable<DeviceId>, state: DeviceState | null) => void;
type SetValueType = (id: NonNullable<DeviceId>, name: string, value: any) => void;
type ContextType = { state: StateType, setDeviceState: SetStateType, setDeviceValue: SetValueType };

const DevicesStateContext = createContext<ContextType>({} as any);
const DevicesStateProvider: React.FC<{}> = ({ children }) => {
  const [state, setState] = useState<StateType>({});
  const setDeviceState = useCallback(
    (id: NonNullable<DeviceId>, deviceState: DeviceState | null) =>
      setState(produce((draft) => {
        draft[id] = deviceState;
      })),
    [setState],
  );
  const setDeviceValue = useCallback(
    (id: NonNullable<DeviceId>, name: string, value: any) =>
      setState(produce((draft) => {
        (draft[id] || {})[name] = value;
      })),
    [setState],
  );
  return useMemo(
    () => (
      <DevicesStateContext.Provider
        value={{
          state,
          setDeviceState,
          setDeviceValue,
        }}
      >
        {children}
      </DevicesStateContext.Provider>
    ),
    [state, setState, children],
  );
};

const useDevicesState = () => useContext(DevicesStateContext);

export const useDevice = (id: DeviceId) => {
  // console.log('deviceid', id);
  const { state, setDeviceState, setDeviceValue } = useDevicesState();
  const deviceState: DeviceState | null = id && state[id] || null;
  const { devices } = useDevicesContext();
  const [device, setDevice] = useState(id && devices.find(device => device.id === id) || null);
  useEffect(
    () => {
      if (!device || devices.includes(device)) return;
      setDevice(null);
    },
    [devices, device],
  );
  const names: string[] = useMemo(
    () => Object.entries<string[]>(Reflect.getMetadata('map', device || {}) || {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, names]) => names[0])
      .filter(name => Reflect.getMetadata('isReadable', device!, name)),
    [device],
  );
  const [error, setError] = useState<Error | string | undefined>();
  const reload = useCallback(
    () => {
      if (!device) return Promise.resolve();
      setError(undefined);
      return device.read().then(
        update,
        err => setError(err),
      );
    },
    [device],
  );
  const isDirty = useCallback((name: string) => device && device.isDirty(name) || false, [device]);
  useEffect(
    () => { deviceState || reload(); },
    [reload],
  );
  const update = useCallback(
    () => {
      // console.log('UPDATE', names.length);
      if (!device) return;
      setDeviceState(
        id!,
        names.reduce(
          (props, name) => {
            props[name] = device.getError(name) || device[name];
            return props;
          },
          {} as Record<string, any>,
        ),
      );
    },
    [device],
  );
  const drain = useCallback(
    debounce(
      () => device && device.drain()
        .then((ids) => {
          console.log('DRAIN', ids);
          const failed = ids.filter(id => id < 0).map(id => -id);
          return failed && failed.length ? device.read(...failed) : Promise.resolve({});
        })
        .then(update),
      200,
    ),
    [device],
  );

  const setValue = useCallback(
    (name: string, value: any) => {
      if (!device) return;
      setDeviceValue(id!, name, value);
      device[name] = value;
      drain();
    },
    [device],
  );

  return useMemo(
    () => ({
      device,
      setValue,
      reload,
      error,
      isDirty,
      props: deviceState || {},
      id: device && device.id,
      proto: device && Reflect.getPrototypeOf(device) || {},
    }),
    [deviceState, id, error, device],
  );
};

export default DevicesStateProvider;
