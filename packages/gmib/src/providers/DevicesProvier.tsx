/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
// import { getState } from '../util/helpers';
import { NibusConnection, CreateDevice, IDevice, devices as coreDevices } from '@nibus/core';
import { useSessionContext } from './SessionProvider';
import StubDevice from '../components/StubDevice';

type Devices = {
  createDevice: CreateDevice;
  setCurrent: (device: DeviceId) => void;
  readonly current: DeviceId;
  // eslint-disable-next-line @typescript-eslint/ban-types
  getProto: (device: DeviceId) => object;
  devices: ReadonlyArray<IDevice>;
};

const stubDeviceAPI: Devices = {
  createDevice: coreDevices.create.bind(coreDevices),
  setCurrent: () => {},
  current: null,
  getProto: () => ({}),
  devices: [],
};

export type DeviceId = string | null;
const emptyProto = Object.freeze({});
const useDevices = (): Devices => {
  const { devices, session } = useSessionContext();
  const createDevice = useMemo<CreateDevice>(() => devices.create.bind(devices), [devices]);
  type DeviceType = ReturnType<typeof createDevice>;
  const [devs, setDevices] = useState(devices.get());
  const [current, setCurrent] = useState<DeviceId>(null);
  const stubDevices = useRef<StubDevice[]>([]);
  const getProto = useCallback(
    (id: DeviceId) => {
      if (!id) return emptyProto;
      const device = devices.get().find(item => item.id === id);
      return device ? Reflect.getPrototypeOf(device) : emptyProto;
    },
    [devices]
  );
  useEffect(() => {
    const updateHandler = (): void => setDevices(devices.get().concat(stubDevices.current));
    const disconnectHandler = (device: DeviceType): void => {
      setCurrent(cur => {
        const result = device.id === cur ? null : cur;
        device.release();
        return result;
      });
    };
    const pureConnectionHandler = (connection: NibusConnection): void => {
      if (devices.get().findIndex(dev => dev && dev.connection === connection) !== -1) return;
      stubDevices.current.push(new StubDevice(connection));
      updateHandler();
    };
    const removeStubHandler = (connection: NibusConnection): void => {
      const index = stubDevices.current.findIndex(dev => dev.connection === connection);
      if (index !== -1) {
        const [stub] = stubDevices.current.splice(index, 1);
        stub.connection = undefined;
        updateHandler();
      }
    };
    const closeHandler = (): void => {
      stubDevices.current.length = 0;
      updateHandler();
    };
    session.on('disconnected', disconnectHandler);
    devices.on('delete', updateHandler);
    devices.on('new', updateHandler);
    session.on('pureConnection', pureConnectionHandler);
    session.on('remove', removeStubHandler);
    session.on('close', closeHandler);

    return () => {
      devices.off('new', updateHandler);
      devices.off('delete', updateHandler);
      session.off('disconnected', disconnectHandler);
      session.off('pureConnection', pureConnectionHandler);
      session.off('remove', removeStubHandler);
      session.off('close', closeHandler);
    };
  }, [setDevices, setCurrent, devices, session]);

  // return {
  //   createDevice,
  //   setCurrent,
  //   current,
  //   getProto,
  //   devices: devs,
  // };

  return useMemo(
    () => ({
      createDevice,
      setCurrent,
      current,
      getProto,
      devices: devs,
    }),
    [createDevice, current, devs, getProto]
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DevicesContext = createContext<Devices>(stubDeviceAPI);
export const useDevicesContext = (): Devices => useContext(DevicesContext);
const DevicesProvider: React.FC = ({ children }) => {
  const context = useDevices();
  // const value = useMemo(() => context, [context.current, context.devices]);
  return <DevicesContext.Provider value={context}>{children}</DevicesContext.Provider>;
};

export default DevicesProvider;
