/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
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
import { getState } from '../util/helpers';
import { useSessionContext } from './SessionProvider';
import { NibusConnection } from '@nibus/core/lib/nibus';
import StubDevice from '../components/StubDevice';

export type DeviceId = string | null;
const emptyProto = Object.freeze({});
const useDevices = () => {
  const { devices, session } = useSessionContext();
  const createDevice = useCallback(devices.create.bind(devices), []);
  type DeviceType = ReturnType<typeof createDevice>;
  const [devs, setDevices] = useState(devices.get());
  const [current, setCurrent] = useState<DeviceId>(null);
  const stubDevices = useRef<StubDevice[]>([]);
  const getProto = useCallback(
    (id: DeviceId) => {
      if (!id) return emptyProto;
      const device = devices.get().find(device => device.id === id);
      return device ? Reflect.getPrototypeOf(device) : emptyProto;
    },
    [devices],
  );
  useEffect(
    () => {
      const updateHandler = () => setDevices(devices.get().concat(stubDevices.current));
      const disconnectHandler = (device: DeviceType) => {
        setCurrent((current) => {
          const result = device.id === current ? null : current;
          device.release();
          return result;
        });
      };
      const pureConnectionHandler = (connection: NibusConnection) => {
        stubDevices.current.push(new StubDevice(connection));
        updateHandler();
      };
      const removeStubHandler = (connection: NibusConnection) => {
        const index = stubDevices.current.findIndex(dev => dev.connection === connection);
        if (index !== -1) {
          const [stub] = stubDevices.current.splice(index, 1);
          stub.connection = undefined;
          updateHandler();
        }
      };
      const closeHandler = () => {
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
    },
    [setDevices, setCurrent, devices, session],
  );

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
    [current, devs],
  );
};
const DevicesContext = createContext<ReturnType<typeof useDevices>>(undefined as any);
export const useDevicesContext = () => useContext(DevicesContext);
const DevicesProvider: React.FC<{}> = ({ children }) => {
  const context = useDevices();
  // const value = useMemo(() => context, [context.current, context.devices]);
  return (
    <DevicesContext.Provider value={context}>
      {children}
    </DevicesContext.Provider>
  );
};

export default DevicesProvider;
