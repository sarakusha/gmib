/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { getMibTypes } from '@nibus/core';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from './index';

type MibTypes = { value: string; name: string }[];

interface NibusState {
  mibTypes: MibTypes;
  // logLevel: LogLevel;
}

const initialState: NibusState = {
  mibTypes: Object.entries(getMibTypes()!)
    .map(([type, mibs]) => ({
      value: type,
      name: mibs.map(mib => mib.mib).join() as string,
    }))
    .filter(types => types.value !== '0')
    .sort((a, b) => a.name.localeCompare(b.name)),
  // logLevel: 'none',
};

/*
export const createDevice = (
  session: SessionId,
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
  setImmediate(() => {
    dispatch(setParent([device.id, parent]));
  });
};
*/

export const selectNibus = (state: RootState): NibusState => state.nibus;
export const selectMibTypes = (state: RootState): MibTypes => selectNibus(state).mibTypes;
// export const selectLogLevel = (state: RootState): LogLevel => selectNibus(state).logLevel;

// let releaseSession: (() => void) | undefined;

export const nibusSlice = createSlice({
  name: 'nibus',
  initialState,
  reducers: {
    // setLogLevel(state, { payload: level }: PayloadAction<LogLevel>) {
    //   state.logLevel = level;
    // },
  },
});

// export const { setLogLevel } = nibusSlice.actions;
// const { setStatus, setPortCount, setLogLevel } = sessionSlice.actions;

// export const startNibus: AsyncInitializer = (dispatch, getState) => {
// const updatePortsHandler = (): void => {
//   dispatch(setPortCount(session.ports));
// };
// const foundHandler: FoundListener = async ({ address, connection }) => {
//   try {
//     if (connection.description.mib) {
//       session.devices.create(address, connection.description.mib, connection);
//     } else {
//       const [version, type] = await connection.getVersion(address);
//       session.devices.create(address, type!, version, connection);
//     }
//   } catch (e) {
//     console.error('error in found handler', e);
//   }
// };
// const newDeviceHandler = (device: IDevice): void => {
//   const { id } = device;
//   const connectedHandler = (): void => {
//     dispatch(setConnected(id));
//     dispatch(reloadDevice(id));
//   };
//   const disconnectedHandler = (): void => {
//     try {
//       const current = selectCurrentDeviceId(getState() as RootState);
//       if (current === id) {
//         dispatch(setCurrentDevice(undefined));
//       }
//     } catch (e) {
//       console.error(`error while disconnect: ${e.message}`);
//     }
//     device.release();
//   };
//   const addressHandler = (prev: Address, address: Address): void => {
//     dispatch(changeAddress([id, address.toString()]));
//   };
//   const releaseHandler = (): void => {
//     device.off('connected', connectedHandler);
//     device.off('disconnected', disconnectedHandler);
//     device.off('release', releaseHandler);
//     device.off('addressChanged', addressHandler);
//   };
//   device.on('connected', connectedHandler);
//   device.on('disconnected', disconnectedHandler);
//   device.on('release', releaseHandler);
//   device.on('addressChanged', addressHandler);
//
//   device.read().finally(() => {
//     dispatch(addMib(id));
//     dispatch(addDevice(id));
//     selectCurrentDeviceId(getState() as RootState) || dispatch(setCurrentDevice(id));
//   });
// };
// const deleteDeviceHandler = (device: IDevice): void => {
//   try {
//     dispatch(removeDevice(device.id));
//   } catch (e) {
//     console.error(e.message);
//   }
// };
// const logLevelHandler = (level: LogLevel): void => {
//   dispatch(setLogLevel(level));
// };
// releaseSession && releaseSession();
// session.on('add', updatePortsHandler);
// session.on('remove', updatePortsHandler);
// session.on('found', foundHandler);
// session.on('logLevel', logLevelHandler);
// session.devices.on('new', newDeviceHandler);
// session.devices.on('delete', deleteDeviceHandler);
// releaseSession = () => {
//   session.off('add', updatePortsHandler);
//   session.off('remove', updatePortsHandler);
//   session.off('found', foundHandler);
//   session.off('logLevel', logLevelHandler);
// };
// const start = (): void => {
//   dispatch(setStatus(['pending']));
//   session
//     .start()
//     .then(ports => {
//       dispatch(setPortCount(ports));
//       dispatch(setStatus(['succeeded']));
//     })
//     .catch(e => {
//       // ipcRenderer.send('startLocalNibus');
//       dispatch(setStatus(['failed', e.message]));
//       setTimeout(start, 3000);
//     });
// };
// start();
// window.addEventListener('beforeunload', () => dispatch(closeNibus()));
// };

export default nibusSlice.reducer;
