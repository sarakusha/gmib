/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import session, { FoundListener, mib } from '@nata/nibus.js-client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
const { devices } = mib;

const context = {
  session,
  devices,
};

const SessionContext = createContext(context);

export const useSessionContext = () => useContext(SessionContext);
const useSessionStart = () => {
  const [ports, setPorts] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const updatePortsHandler = useCallback(
    () => setPorts(session.ports),
    [],
  );
  const foundHandler = useCallback<FoundListener>(
    async ({ address, connection }) => {
      // console.log('FOUND', connection.description, address.toString());
      try {
        if (connection.description.mib) {
          const device = devices.create(address, connection.description.mib);
          // devices.create('::3', connection.description.mib).connection = connection;
          device.connection = connection;
        } else {
          const [version, type] = await connection.getVersion(address);
          const device = devices.create(address, type!, version);
          connection.description.mib = Reflect.getMetadata('mib', device);
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
        setError(null);
        session.on('add', updatePortsHandler);
        session.on('remove', updatePortsHandler);
        session.on('found', foundHandler);
      },
      (error) => {
        setError(error);
        ipcRenderer.send('startLocalNibus');
        setTimeout(
          () => {
            setAttempt(attempt => attempt + 1);
            console.log('try connect', attempt);
          },
          3000,
        );
      },
    );
    return () => {
      session.off('add', updatePortsHandler);
      session.off('remove', updatePortsHandler);
      session.off('found', foundHandler);
      session.close();
    };
  };
  useEffect(request, [attempt, setPorts, setError, setAttempt]);
  return {
    ports,
    error,
  };
};

export const SessionProvider: React.FC<{}> = ({ children }) => {
  const { error } = useSessionStart();
  return (
    <SessionContext.Provider value={context}>
      {error && error.message || children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
