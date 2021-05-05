/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Socket, connect } from 'net';
import { FoundListener, DeviceId, Host, Display, PortArg } from '@nibus/core';
import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ipcRenderer } from 'electron';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as novastar from '@novastar/core';

import type { Config } from '../util/config';
import { getSession } from '../util/helpers';
import { AsyncInitializer } from './asyncInitialMiddleware';
import { loadConfig, selectCurrentSessionId } from './configSlice';
import { addDevicesListener } from './devicesSlice';
import type { AppThunk, RootState } from './index';
import { addSensorsListener } from './sensorsSlice';
// import debugFactory from '../util/debug';

// const debug = debugFactory('gmib:sessionsSlice');

const RESTART_DELAY = 3000;

export type SessionStatus = 'idle' | 'pending' | 'succeeded' | 'failed' | 'closed';
export type SessionId = `${string}:${number}`;

type NovastarSession = novastar.Session<Socket>;

export interface SessionState extends Partial<Host> {
  id: SessionId;
  status: SessionStatus;
  error: string | undefined;
  portCount: number;
  devices: DeviceId[];
  online: boolean;
  remote: boolean;
  displays: Display[];
  novastarSessions: NovastarSession[];
  // config: Config | undefined;
}

const sessionAdapter = createEntityAdapter<SessionState>({ selectId: session => session.id });

export const { selectById: selectSessionById } = sessionAdapter.getSelectors<RootState>(state => state.sessions);

export const selectCurrentSession = (state: RootState): SessionState | undefined => selectSessionById(
  state,
  selectCurrentSessionId(state),
);

export const selectIsRemote = (state: RootState): boolean => !!selectCurrentSession(state)?.remote;

export const selectIsOnline = (state: RootState): boolean => !!selectCurrentSession(state)?.online;

export const selectIsClosed = (state: RootState): boolean => selectCurrentSession(state)?.status === 'closed';

export const selectDisplays = (state: RootState): Display[] => selectCurrentSession(state)?.displays ?? [];

export const selectNovastarSessions = (state: RootState): NovastarSession[] => selectCurrentSession(
  state)?.novastarSessions ?? [];

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState: sessionAdapter.getInitialState(),
  reducers: {
    closeSession: (state, { payload: id }: PayloadAction<SessionId>) => {
      if (!state.ids.includes(id)) {
        console.warn(`Unknown session id: ${id}`);
        return;
      }
      const session = getSession(id);
      session.close();
      /*
            sessionAdapter.updateOne(
              state,
              {
                id,
                changes: {
                  status: 'closed',
                  portCount: 0,
                },
              },
            );
      */
    },
    reloadSession: (state, { payload: id }: PayloadAction<SessionId>) => {
      if (!state.ids.includes(id)) {
        console.warn(`Unknown session id: ${id}`);
        return;
      }
      const session = getSession(id);
      session.reloadDevices();
    },
    addSession: sessionAdapter.addOne,
    updateSession: sessionAdapter.updateOne,
    removeSession: sessionAdapter.removeOne,
  },
});
const {
  addSession,
} = sessionsSlice.actions;
export const {
  closeSession,
  reloadSession,
  removeSession,
  updateSession,
} = sessionsSlice.actions;

export const openSession = (id: SessionId): AppThunk => (dispatch, getState) => {
  if (selectSessionById(getState(), id)) return;
  // Глюк, если не привести к string падает webpack!
  const [host, port] = (id as string).split(':');
  const remote = !!host && host !== 'localhost';
  const session = getSession(id);
  const updatePortsHandler = (): void => {
    dispatch(updateSession({
      id,
      changes: { portCount: session.ports },
    }));
  };
  const foundHandler: FoundListener = async ({
    address,
    connection,
  }) => {
    // const addresses = selectScreenAddresses(getState());
    try {
      if (connection.description.mib) {
        session.devices.create(address, connection.description.mib, connection);
      } else {
        const {
          version,
          type,
        } = await connection.getVersion(address) ?? {};
        session.devices.create(address, type!, version, connection);
      }
    } catch (e) {
      console.error('error in found handler', e);
    }
  };
  const updateDevices = (): void => {
    dispatch(updateSession({
      id,
      changes: { devices: session.devices.get().map(device => device.id) },
    }));
  };
  // const logLevelHandler = (level: LogLevel): void => {
  //   dispatch(setLogLevel(level));
  // };

  const configHandler = (config: Config): void => {
    // TODO: Возможно лишняя проверка
    const currentSession = selectCurrentSessionId(getState());
    if (currentSession === id) {
      dispatch(loadConfig(config));
    }
  };

  const hostHandler = (hostArgs: Host): void => {
    dispatch(updateSession({
      id,
      changes: hostArgs,
    }));
  };

  const onlineHandler = (online: boolean): void => {
    dispatch(updateSession({
      id,
      changes: { online },
    }));
  };

  const displaysHandler = (displays: Display[]): void => {
    dispatch(updateSession({
      id,
      changes: { displays },
    }));
  };

  const selectNovastar = (): NovastarSession[] => selectSessionById(
    getState(),
    id,
  )?.novastarSessions ?? [];

  const addForeignDeviceHandler = async ({
    portInfo: { path },
    description,
  }: PortArg): Promise<void> => {
    if (description.category !== 'novastar') return;
    const socket = connect(+port, host, () => {
      socket.write(path);
      window.setTimeout(() => {
        const connection = new novastar.Connection(socket);
        connection.start().then(() => {

          const novastarSession = new novastar.Session(connection);
          dispatch(updateSession({
            id,
            changes: {
              novastarSessions: [...selectNovastar(), novastarSession],
            },
          }));
          socket.once('close', () => {
            novastarSession.close();
          });
          novastarSession.once('close', () => {
            dispatch(updateSession({
              id,
              changes: {
                novastarSessions: selectNovastar().filter(item => item !== novastarSession),
              },
            }));

            if (!socket.destroyed) socket.destroy();
          });
        });
      }, 100);
    });
  };
  // const removeForeignDeviceHandler = ({} : PortArg): void => {};

  const removeSensorsListener = dispatch(addSensorsListener(id));
  const removeDevicesListener = dispatch(addDevicesListener(id));

  session.on('displays', displaysHandler);
  session.on('online', onlineHandler);
  session.on('add', updatePortsHandler);
  session.on('remove', updatePortsHandler);
  session.on('found', foundHandler);
  // session.on('logLevel', logLevelHandler);
  session.on('config', configHandler);
  session.once('host', hostHandler);
  session.devices.on('new', updateDevices);
  session.devices.on('delete', updateDevices);
  const release = (): void => {
    selectNovastar().forEach(novastarSession => novastarSession.close());
    session.off('displays', displaysHandler);
    session.off('online', onlineHandler);
    session.off('add', updatePortsHandler);
    session.off('remove', updatePortsHandler);
    session.off('found', foundHandler);
    // session.off('logLevel', logLevelHandler);
    session.off('config', configHandler);
    session.off('host', hostHandler);
    session.devices.off('new', updateDevices);
    session.devices.off('delete', updateDevices);
    removeSensorsListener();
    removeDevicesListener();
    dispatch(
      updateSession(
        {
          id,
          changes: {
            status: 'closed',
            online: false,
            portCount: 0,
            displays: [],
            novastarSessions: [],
          },
        },
      ));
    // if (process.env.NODE_ENV !== 'development')
    //   window.close();
  };
  session.once('close', release);
  dispatch(addSession({
    id,
    status: 'pending',
    error: undefined,
    portCount: 0,
    devices: [],
    online: false,
    remote,
    displays: [],
    novastarSessions: [],
    // config: undefined,
  }));
  const start = (): void => {
    const sessionState = selectSessionById(getState(), id);
    if (!sessionState || sessionState.status === 'closed' || sessionState.status === 'succeeded') return;
    session
      .start()
      .then(ports => {
        const socket = session.getSocket();
        if (socket) {
          socket.once('close', () => {
            socket.off('add', addForeignDeviceHandler);
            // socket.off('remove', removeForeignDeviceHandler);
          });
          socket.on('add', addForeignDeviceHandler);
          // socket.on('remove', removeForeignDeviceHandler);
        }
        dispatch(updateSession({
          id,
          changes: {
            status: 'succeeded',
            portCount: ports,
            error: undefined,
          },
        }));
      })
      .catch(e => {
        if (!remote) {
          ipcRenderer.send('startLocalNibus');
        } else {
          console.error(`error while start session on ${id}: ${e.message}`);
        }
        dispatch(updateSession({
          id,
          changes: {
            status: 'failed',
            portCount: 0,
            error: e.message,
          },
        }));
        setTimeout(start, RESTART_DELAY);
      });
  };
  start();
  window.addEventListener('beforeunload', () => {
    session.close();
  });
};

export const startNibus: AsyncInitializer = (dispatch, getState) => {
  const session = selectCurrentSessionId(getState() as RootState);
  dispatch(openSession(session));
};

export default sessionsSlice.reducer;

