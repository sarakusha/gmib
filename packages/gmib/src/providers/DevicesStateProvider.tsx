/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { IDevice } from '@nibus/core';
import produce from 'immer';
import debounce from 'lodash/debounce';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeviceId, useDevicesContext } from './DevicesProvier';

type DeviceState = Record<string, any>;
type StateType = Record<NonNullable<DeviceId>, DeviceState | null>;
type SetStateType = (id: NonNullable<DeviceId>, state: DeviceState | null) => void;
type SetValueType = (id: NonNullable<DeviceId>, name: string, value: any) => void;
type ContextType = { state: StateType; setDeviceState: SetStateType; setDeviceValue: SetValueType };

const DevicesStateContext = createContext<ContextType>({} as any);
const DevicesStateProvider: React.FC = ({ children }) => {
  const [state, setState] = useState<StateType>({});
  const setDeviceState = useCallback(
    (id: NonNullable<DeviceId>, deviceState: DeviceState | null) =>
      setState(
        produce(draft => {
          draft[id] = deviceState;
        })
      ),
    [setState]
  );
  const setDeviceValue = useCallback(
    (id: NonNullable<DeviceId>, name: string, value: any) =>
      setState(
        produce(draft => {
          (draft[id] || {})[name] = value;
        })
      ),
    [setState]
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
    [state, setDeviceState, setDeviceValue, children]
  );
};

const useDevicesState = (): ContextType => useContext(DevicesStateContext);

type CurrentDevice = {
  readonly device?: IDevice | null;
  setValue: (name: string, value: any) => void;
  reload: () => Promise<void>;
  readonly error?: Error | string;
  isDirty: (name: string) => boolean;
  readonly props: Record<string, any>;
  readonly id?: DeviceId;
  // eslint-disable-next-line @typescript-eslint/ban-types
  proto?: object;
  names: string[];
};

type NameId = { name: string; id: string };
// eslint-disable-next-line @typescript-eslint/ban-types
const getRank = (proto: Object | null | undefined, item: NameId): number =>
  // eslint-disable-next-line no-bitwise
  (((proto && Number(Reflect.getMetadata('rank', proto, item.name))) || 10000) << 16) +
  Number(item.id);
// eslint-disable-next-line @typescript-eslint/ban-types
const sortProperties = (proto?: Object | null) => (a: NameId, b: NameId): number => {
  const [rankA, rankB] = [a, b].map(item => getRank(proto, item));
  return rankA - rankB;
};

export const useDevice = (id: DeviceId): CurrentDevice => {
  // console.log('deviceid', id);
  const { state, setDeviceState, setDeviceValue } = useDevicesState();
  const deviceState: DeviceState | null = id ? state[id] : null;
  const { devices } = useDevicesContext();
  const [device, setDevice] = useState(id ? devices.find(item => item.id === id) : null);
  useEffect(() => {
    if (!device || devices.includes(device)) return;
    setDevice(null);
  }, [devices, device]);
  const proto = useMemo(() => (device ? Reflect.getPrototypeOf(device) : {}), [device]);
  const names: string[] = useMemo(() => {
    const sort = sortProperties(proto);
    const map = Reflect.getMetadata('map', proto ?? {});
    if (!map) return [];
    return Object.entries<string[]>(map)
      .sort(([idA, [nameA]], [idB, [nameB]]) =>
        sort({ id: idA, name: nameA }, { id: idB, name: nameB })
      )
      .reduce((res, [, keys]) => [...res, ...keys], [])
      .filter(name => !proto || Reflect.getMetadata('isReadable', proto, name));
  }, [proto]);
  const [error, setError] = useState<Error | string | undefined>();
  const isDirty = useCallback((name: string) => (device ? device.isDirty(name) : false), [device]);
  const update = useCallback(() => {
    // console.log('UPDATE', names.length);
    if (!device) return;
    setDeviceState(
      id!,
      names.reduce((props, name) => {
        props[name] = device.getError(name) ?? device[name];
        if (Number.isNaN(props[name])) console.log('NaN', name);
        return props;
      }, {} as Record<string, any>)
    );
  }, [device, id, names, setDeviceState]);
  const reload = useCallback(() => {
    if (!device) return Promise.resolve();
    setError(undefined);
    return device.read().then(update, err => setError(err));
  }, [device, update]);
  useEffect(() => {
    deviceState || reload();
  }, [deviceState, reload]);
  const drain = useMemo(
    () =>
      debounce(
        () =>
          device &&
          device
            .drain()
            .then(ids => {
              const failed = ids.filter(ident => ident < 0).map(ident => -ident);
              return failed && failed.length ? device.read(...failed) : Promise.resolve({});
            })
            .then(update),
        400
      ),
    [device, update]
  );

  const setValue = useCallback(
    (name: string, value: any) => {
      if (!device) return;
      setDeviceValue(id!, name, value);
      device[name] = value;
      drain();
    },
    [device, drain, id, setDeviceValue]
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
      proto,
      names,
    }),
    [device, setValue, reload, error, isDirty, deviceState, proto, names]
  );
};

export default DevicesStateProvider;
