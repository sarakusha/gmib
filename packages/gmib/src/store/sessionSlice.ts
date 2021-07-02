/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { FoundListener, DeviceId, Host, Display, PortArg, NibusSessionEvents } from '@nibus/core';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ipcRenderer } from 'electron';

import type { Config } from '../util/config';
import { Health } from '../util/localConfig';
import { getCurrentNibusSession, isRemoteSession } from '../util/nibus';
import { AsyncInitializer } from './asyncInitialMiddleware';
import { selectBrightness } from './configSlice';
import { setCurrentHealth } from './currentSlice';
import type { RootState } from './index';
import { loadConfig } from './configThunks';
import { createNovastarConnection, releaseNovastar, setNovastarBrightness } from './novastarsSlice';
import { ILLUMINATION, pushSensorValue, TEMPERATURE } from './sensorsSlice';
// import debugFactory from '../util/debug';

// const debug = debugFactory('gmib:sessionsSlice');

const RESTART_DELAY = 3000;

export type SessionStatus = 'idle' | 'pending' | 'succeeded' | 'failed' | 'closed';

export interface SessionState extends Partial<Host> {
  status: SessionStatus;
  error: string | undefined;
  portCount: number;
  devices: DeviceId[];
  online: boolean;
  displays: Display[];
}

export const selectSession = (state: RootState): SessionState => state.session;

export const selectIsOnline = (state: RootState): boolean => selectSession(state).online;

export const selectIsClosed = (state: RootState): boolean =>
  selectSession(state).status === 'closed';

export const selectDisplays = (state: RootState): Display[] => selectSession(state).displays;

const initialState: SessionState = {
  status: 'idle',
  error: undefined,
  portCount: 0,
  devices: [],
  online: false,
  displays: [],
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    closeSession() {
      const session = getCurrentNibusSession();
      session.close();
    },
    releaseSession(state) {
      state.status = 'closed';
      state.online = false;
      state.portCount = 0;
      state.displays = [];
    },
    reloadSession() {
      const session = getCurrentNibusSession();
      session.reloadDevices();
    },
    setPortCount(state, { payload: portCount }: PayloadAction<number>) {
      state.portCount = portCount;
    },
    setDevices(state, { payload: devices }: PayloadAction<DeviceId[]>) {
      state.devices = devices;
    },
    setHostDescription(state, { payload: hostDesc }: PayloadAction<Host>) {
      Object.assign(state, hostDesc);
    },
    setOnline(state, { payload: online }: PayloadAction<boolean>) {
      state.online = online;
    },
    setDisplays(state, { payload: displays }: PayloadAction<Display[]>) {
      state.displays = displays;
    },
    setStatus(
      state,
      { payload: status }: PayloadAction<Pick<SessionState, 'status' | 'portCount' | 'error'>>
    ) {
      Object.assign(state, status);
    },
  },
});
const {
  setPortCount,
  setDevices,
  setHostDescription,
  setOnline,
  setDisplays,
  releaseSession,
  setStatus,
} = sessionSlice.actions;
export const { closeSession, reloadSession } = sessionSlice.actions;

export const openSession: AsyncInitializer = (dispatch, getState: () => RootState) => {
  const session = getCurrentNibusSession();
  const updatePortsHandler = (): void => {
    dispatch(setPortCount(session.ports));
  };
  const foundHandler: FoundListener = async ({ address, connection }) => {
    try {
      if (connection.description.mib) {
        session.devices.create(address, connection.description.mib, connection);
      } else {
        const { version, type } = (await connection.getVersion(address)) ?? {};
        session.devices.create(address, type!, version, connection);
      }
    } catch (e) {
      console.error('error in found handler', e);
    }
  };
  const updateDevices = (): void => {
    dispatch(setDevices(session.devices.get().map(device => device.id)));
  };

  const configHandler = (config: Config): void => {
    dispatch(loadConfig(config));
  };

  const healthHandler = (health: Health): void => {
    // debug(`health ${JSON.stringify(health)}`);
    dispatch(setCurrentHealth(health));
  };

  const hostHandler = (hostArgs: Host): void => {
    dispatch(setHostDescription(hostArgs));
  };

  const onlineHandler = (online: boolean): void => {
    dispatch(setOnline(online));
  };

  const displaysHandler = (displays: Display[]): void => {
    dispatch(setDisplays(displays));
  };

  const addForeignDeviceHandler = async ({
    portInfo: { path },
    description,
  }: PortArg): Promise<void> => {
    if (description.category !== 'novastar') return;
    const { port, host } = session;
    await dispatch(createNovastarConnection(path, port, host));
    dispatch(setNovastarBrightness(selectBrightness(getState())));
  };

  const informationListener: NibusSessionEvents['informationReport'] = (
    connection,
    { id, value, source }
  ) => {
    switch (id) {
      case ILLUMINATION:
        dispatch(pushSensorValue('illuminance', source.toString(), value));
        break;
      case TEMPERATURE:
        dispatch(pushSensorValue('temperature', source.toString(), value));
        break;
      default:
        break;
    }
  };

  session.on('displays', displaysHandler);
  session.on('online', onlineHandler);
  session.on('add', updatePortsHandler);
  session.on('remove', updatePortsHandler);
  session.on('found', foundHandler);
  // session.on('logLevel', logLevelHandler);
  session.on('config', configHandler);
  session.once('host', hostHandler);
  session.on('informationReport', informationListener);
  session.on('foreign', addForeignDeviceHandler);
  session.on('health', healthHandler);
  session.devices.on('new', updateDevices);
  session.devices.on('delete', updateDevices);
  const release = (): void => {
    dispatch(releaseNovastar());
    // Object.values(novastarSessions).forEach(novastarSession => novastarSession.close());
    session.off('displays', displaysHandler);
    session.off('online', onlineHandler);
    session.off('add', updatePortsHandler);
    session.off('remove', updatePortsHandler);
    session.off('found', foundHandler);
    // session.off('logLevel', logLevelHandler);
    session.off('config', configHandler);
    session.off('host', hostHandler);
    session.off('informationReport', informationListener);
    session.off('foreign', addForeignDeviceHandler);
    session.off('health', healthHandler);
    session.devices.off('new', updateDevices);
    session.devices.off('delete', updateDevices);
    // removeDevicesListener();
    dispatch(releaseSession());
  };
  session.once('close', release);
  dispatch(setStatus({ status: 'pending', error: undefined, portCount: 0 }));
  const start = (): void => {
    const { status } = selectSession(getState());
    if (status === 'closed' || status === 'succeeded') return;
    session
      .start()
      .then(ports => {
        dispatch(setStatus({ status: 'succeeded', portCount: ports, error: undefined }));
      })
      .catch(e => {
        if (!isRemoteSession) {
          ipcRenderer.send('startLocalNibus');
        } else {
          console.error(`error while start session: ${e.message}`);
        }
        dispatch(setStatus({ status: 'failed', portCount: 0, error: e.message }));
        setTimeout(start, RESTART_DELAY);
      });
  };
  start();
  window.addEventListener('beforeunload', () => {
    session.close();
  });
};

export default sessionSlice.reducer;
