/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSessionContext } from './SessionProvider';

export type DeviceId = string | null;
const emptyProto = Object.freeze({});
const useDevices = () => {
  const { devices, session } = useSessionContext();
  const createDevice = useCallback(devices.create.bind(devices), []);
  type DeviceType = ReturnType<typeof createDevice>;
  const [devs, setDevices] = useState(devices.get());
  const [current, setCurrent] = useState<DeviceId>(null);
  const getProto = useCallback(
    (id: DeviceId) => {
      if (!id) return emptyProto;
      const device = devs.find(device => device.id === id);
      return device ? Reflect.getPrototypeOf(device) : emptyProto;
    },
    [devs],
  );
  useEffect(
    () => {
      const updateHandler = () => setDevices(devices.get());
      const disconnectHandler = (device: DeviceType) => {
        if (device.id === current) {
          setCurrent(null);
        }
        console.log('RELEASE', device.address.toString());
        device.release();
      };
      session.on('disconnected', disconnectHandler);
      devices.on('delete', updateHandler);
      devices.on('new', updateHandler);
      return () => {
        devices.off('new', updateHandler);
        devices.off('delete', updateHandler);
        session.off('disconnected', disconnectHandler);
      };
    },
    [setDevices, setCurrent, devices],
  );

  return {
    createDevice,
    setCurrent,
    current,
    getProto,
    devices: devs,
  };
};
const DevicesContext = createContext<ReturnType<typeof useDevices>>(undefined as any);
export const useDevicesContext = () => useContext(DevicesContext);
const DevicesProvider: React.FC<{}> = ({ children }) => {
  const context = useDevices();
  return (
    <DevicesContext.Provider value={context}>
      {children}
    </DevicesContext.Provider>
  );
};

export default DevicesProvider;
