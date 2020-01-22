/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import session, { FoundListener, devices } from '@nibus/core';
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { ipcRenderer } from 'electron';
import StartNibusDialog from '../dialogs/StartNibusDialog';


const context = {
  session,
  devices,
};

const SessionContext = createContext(context);

export const useSessionContext = (): typeof context => useContext(SessionContext);
const useSessionStart = (): { ports: number | null; error: Error | null } => {
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
        if (address.isEmpty) {
          // console.log('EMPTY', connection.description);
          return;
        }
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
  const request = (): () => void => {
    const reconnect = (): NodeJS.Timeout => setTimeout(
      () => {
        setAttempt(prev => prev + 1);
      },
      3000,
    );
    session.start().then(
      countPorts => {
        setPorts(countPorts);
        setError(null);
        session.on('add', updatePortsHandler);
        session.on('remove', updatePortsHandler);
        session.on('found', foundHandler);
        session.on('close', reconnect);
      },
      err => {
        setError(err);
        ipcRenderer.send('startLocalNibus');
        reconnect();
      },
    );
    return () => {
      session.off('add', updatePortsHandler);
      session.off('remove', updatePortsHandler);
      session.off('found', foundHandler);
      session.off('close', reconnect);
      session.close();
    };
  };
  useEffect(request, [setPorts, setError, setAttempt, attempt]);
  return {
    ports,
    error,
  };
};

const SessionProvider: React.FC = ({ children }) => {
  const { error } = useSessionStart();
  return (
    <SessionContext.Provider value={context}>
      <StartNibusDialog open={!!error} />
      {children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
