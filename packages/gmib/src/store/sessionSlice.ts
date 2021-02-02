/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import session, { FoundListener, getMibTypes, IDevice } from '@nibus/core';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ipcRenderer } from 'electron';
import { AsyncLoader } from './asyncInitialMiddleware';
import {
  addDevice,
  DeviceId,
  reloadDevice,
  removeDevice,
  setConnected,
  setParent,
} from './devicesSlice';

import type { AppThunk, RootState } from './index';
import { addMib } from './mibsSlice';

type SessionStatus = 'idle' | 'pending' | 'succeeded' | 'failed' | 'closed';

type MibTypes = { value: string; name: string }[];

interface SessionState {
  status: SessionStatus;
  error: string | undefined;
  portCount: number;
  mibTypes: MibTypes;
}

const initialState: SessionState = {
  status: 'idle',
  error: undefined,
  portCount: 0,
  mibTypes: Object.entries(getMibTypes()!)
    .map(([type, mibs]) => ({
      value: type,
      name: mibs.map(mib => mib.mib).join() as string,
    }))
    .filter(types => types.value !== '0')
    .sort((a, b) => a.name.localeCompare(b.name)),
};

export const createDevice = (
  parent: DeviceId,
  address: string,
  type: number,
  version?: number
): AppThunk => dispatch => {
  const device = session.devices.create(address, type!, version);
  const parentDevice = session.devices.findById(parent);
  if (parentDevice) {
    device.connection = parentDevice.connection;
  }
  process.nextTick(() => {
    dispatch(setParent([device.id, parent]));
  });
};

export const selectSession = (state: RootState): SessionState => state.session;
export const selectMibTypes = (state: RootState): MibTypes => selectSession(state).mibTypes;

let releaseSession: (() => void) | undefined;

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    close: state => {
      state.status = 'closed';
      state.portCount = 0;
      session.close();
      if (releaseSession) {
        releaseSession();
        releaseSession = undefined;
      }
    },
    reloadAll() {
      session.reloadDevices();
    },
    setStatus(
      state,
      { payload: [status, error] }: PayloadAction<[status: SessionStatus, error?: string]>
    ) {
      state.status = status;
      state.error = error;
    },
    setPortCount(state, { payload: ports }: PayloadAction<number>) {
      state.portCount = ports;
    },
  },
});

export const { close, reloadAll } = sessionSlice.actions;
const { setStatus, setPortCount } = sessionSlice.actions;

export const nibusStart = (): AsyncLoader => dispatch => {
  const updatePortsHandler = (): void => {
    dispatch(setPortCount(session.ports));
  };
  const foundHandler: FoundListener = async ({ address, connection }) => {
    try {
      if (connection.description.mib) {
        session.devices.create(address, connection.description.mib, connection);
      } else {
        const [version, type] = await connection.getVersion(address);
        session.devices.create(address, type!, version, connection);
      }
    } catch (e) {
      console.error('error in found handler', e);
    }
  };
  const newDeviceHandler = (device: IDevice): void => {
    const { id } = device;
    const connectedHandler = (): void => {
      dispatch(setConnected(id));
      dispatch(reloadDevice(id));
    };
    const releaseHandler = (): void => {
      device.off('connected', connectedHandler);
      device.off('disconnected', connectedHandler);
      device.off('release', releaseHandler);
    };
    device.on('connected', connectedHandler);
    device.on('disconnected', connectedHandler);
    device.on('release', releaseHandler);

    device.read().finally(() => {
      dispatch(addMib(id));
      dispatch(addDevice(id));
    });
  };
  const deleteDeviceHandler = (device: IDevice): void => {
    dispatch(removeDevice(device.id));
  };
  releaseSession && releaseSession();
  session.on('add', updatePortsHandler);
  session.on('remove', updatePortsHandler);
  session.on('found', foundHandler);
  session.devices.on('new', newDeviceHandler);
  session.devices.on('delete', deleteDeviceHandler);
  releaseSession = () => {
    session.off('add', updatePortsHandler);
    session.off('remove', updatePortsHandler);
    session.off('found', foundHandler);
  };
  const start = (): void => {
    dispatch(setStatus(['pending']));
    session
      .start()
      .then(ports => {
        dispatch(setPortCount(ports));
        dispatch(setStatus(['succeeded']));
      })
      .catch(e => {
        ipcRenderer.send('startLocalNibus');
        dispatch(setStatus(['failed', e.message]));
        setTimeout(start, 3000);
      });
  };
  start();
};

export default sessionSlice.reducer;
