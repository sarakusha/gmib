/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import session from '@nata/nibus.js-client';
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSessionContext } from './SessionContext';

type DeviceId = string | undefined;
const emptyProto = Object.freeze({});
const useDevices = () => {
  const { devices } = useSessionContext();
  const createDevice = useCallback(devices.create.bind(devices), []);
  const [devs, setDevices] = useState(devices.get());
  const [current, setCurrent] = useState<DeviceId>();
  const getProto = useCallback(
    (id: DeviceId) => {
      if (!id) return emptyProto;
      const device = devs.find(device => device.id === id);
      return device ? Reflect.getPrototypeOf(device) : emptyProto;
    },
    [],
  );
  useEffect(
    () => {
      const updateHandler = () => setDevices(devices.get());
      const disconnectHandler = (device: IDevice) => {
        if (device.id === current) {
          setCurrent(undefined);
        }
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
  );

  return {
    createDevice,
    setCurrent,
    current,
    getProto,
    devices: devs,
  };
};
export const DevicesContext = createContext<ReturnType<typeof useDevices>>(undefined as any);
export const DevicesProvider: React.FC<{}> = ({ children }) => {
  const context = useDevices();
  return (
    <DevicesContext.Provider value={context}>
      {children}
    </DevicesContext.Provider>
  );
};
export const useDevicesContext = () => useContext(DevicesContext);
