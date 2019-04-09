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
  useContext,
  ReactNode,
  useEffect,
  useState,
  useCallback,
} from 'react';
import session, { mib, FoundListener, DeviceListener } from '@nata/nibus.js-client';
import { IDevice } from '@nata/nibus.js-client/lib/mib';

const { devices } = mib;

const SessionContext = createContext({
  session,
  devices,
});

export const useSession = () => useContext(SessionContext).session;
const useSessionStart = () => {
  const [ports, setPorts] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const updatePortsHandler = useCallback(
    () => setPorts(session.ports),
    [],
  );
  const foundHandler = useCallback<FoundListener>(
    async ({ address, connection }) => {
      try {
        if (connection.description.mib) {
          devices.create(address, connection.description.mib);
        } else {
          const [version, type] = await connection.getVersion(address);
          const device = devices.create(address, type, version);
          device.connection = connection;
        }
      } catch (e) {
        console.error('error in found handler', e);
      }
    },
    [],
  );
  const request = () => {
    session.start().then(
      (ports) => {
        setPorts(ports);
        session.on('add', updatePortsHandler);
        session.on('remove', updatePortsHandler);
        session.on('found', foundHandler);
      },
      error => setError(error),
    );
    return () => {
      session.off('add', updatePortsHandler);
      session.off('remove', updatePortsHandler);
      session.off('found', foundHandler);
      session.close();
    };
  };
  useEffect(request, []);
  return {
    ports,
    error,
  };
};

type Props = {
  children: ReactNode,
};

export const SessionProvider = ({ children }: Props) => {
  useSessionStart();
  return (
    <SessionContext.Provider
      value={{
        session,
        devices,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

const createDevice = devices.create.bind(devices);
type DevicesType = [IDevice[], typeof createDevice];
type DevicesHandlers = {
  onNew?: DeviceListener,
  onDelete?: DeviceListener,
};

export const useDevices = (handlers: DevicesHandlers = {}): DevicesType => {
  const [devs, setDevices] = useState(devices.get());
  const updateDevices = useCallback(() => setDevices(devices.get()), []);
  const newHandler = useCallback<DeviceListener>(
    (device) => {
      updateDevices();
      handlers.onNew && handlers.onNew(device);
    },
    [handlers.onNew],
  );
  const deleteHandler = useCallback<DeviceListener>(
    (device) => {
      updateDevices();
      handlers.onDelete && handlers.onDelete(device);
    },
    [handlers.onDelete],
  );
  const disconnectHandler = useCallback<DeviceListener>(
    (device) => {
      device.release();
      // updateDevices();
    },
    [],
  );
  useEffect(
    () => {
      devices.on('new', newHandler);
      return () => {
        devices.off('new', newHandler);
      };
    },
    [newHandler],
  );
  useEffect(
    () => {
      devices.on('delete', deleteHandler);
      return () => {
        devices.off('delete', deleteHandler);
      };
    },
    [deleteHandler],
  );
  useEffect(
    () => {
      session.on('disconnected', disconnectHandler);
      return () => {
        session.off('disconnected', disconnectHandler);
      };
    },
  );
  return [devs, createDevice];
};

export default SessionContext;
