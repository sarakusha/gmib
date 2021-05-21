/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  Address,
  AddressParam,
  AddressType,
  DeviceId,
  findDeviceById,
  IDevice,
  INibusSession,
  MINIHOST_TYPE,
  MCDVI_TYPE,
  VersionInfo,
} from '@nibus/core';
import {
  createAction,
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import debounce from 'lodash/debounce';
import pick from 'lodash/pick';
import { notEmpty, tuplify } from '../util/helpers';
import { getCurrentNibusSession, isRemoteSession } from '../util/nibus';
import { AsyncInitializer } from './asyncInitialMiddleware';
import { initializeScreens, selectBrightness, selectScreenAddresses } from './configSlice';
import type { AppDispatch, AppThunk, RootState } from './index';
import { addMib } from './mibsSlice';
// import debugFactory from '../util/debug';

// const debug = debugFactory('gmib:devicesSlice');

const PINGER_INTERVAL = 10000;

type ValueStatus = 'succeeded' | 'failed' | 'pending';
export type ValueType = string | number | boolean | null;
export type ValueState = {
  status: ValueStatus;
  value: ValueType;
  raw: ValueType;
  error?: string;
};

type PropEntity = [name: string, state: ValueState];

export type DeviceProps = Record<string, ValueState>;
export type PropTuple = [name: string, value: ValueType];

export type DeviceState = {
  id: DeviceId;
  address: string;
  mib: string;
  connected: boolean;
  path?: string;
  isEmptyAddress: boolean;
  props: DeviceProps;
  parent?: DeviceId;
  category?: string;
  isLinkingDevice?: boolean;
  error?: string;
  isBusy: number;
};

export type DeviceStateWithParent = Omit<DeviceState, 'parent'> & { parent?: DeviceState };

// const getSessionId = ({ host, port }: { host?: string; port: number }): SessionId =>
//   `${host ?? ''}:${port}` as SessionId;

const getDeviceProp = (device: IDevice) => (idOrName: string | number): PropEntity => {
  const error = device.getError(idOrName);
  const name = device.getName(idOrName);
  return [
    name,
    {
      status: error ? 'failed' : device.isDirty(idOrName) ? 'pending' : 'succeeded',
      value: device[name],
      error: error?.message,
      raw: device.getRawValue(idOrName),
    },
  ];
};

const getProps = (device: IDevice, idsOrNames?: (number | string)[]): DeviceProps => {
  const proto = Reflect.getPrototypeOf(device) ?? {};
  const names =
    idsOrNames ??
    ((Reflect.getMetadata('mibProperties', proto) as string[]).filter(name =>
      Reflect.getMetadata('isReadable', proto, name)
    ) as (string | number)[]);
  const getProp = getDeviceProp(device);
  return Object.fromEntries<ValueState>(names.map(getProp));
};

const devicesAdapter = createEntityAdapter<DeviceState>({
  selectId: device => device.id,
});

const updateProps = createAction<[id: DeviceId, ids?: number[]]>('devices/updateProps');

export const reloadDevice = createAsyncThunk<void, DeviceId>(
  'devices/reload',
  async (id, { dispatch }) => {
    const device = findDeviceById(id);
    if (device?.connection) {
      await device.read();
      dispatch(updateProps([id]));
    }
  }
);

const drainDevice = createAsyncThunk<void, DeviceId>('devices/drain', async (id, { dispatch }) => {
  const device = findDeviceById(id);
  if (!device) return;
  const ids = await device.drain();
  const failed = ids.filter(ident => ident < 0).map(ident => -ident);
  failed.length > 0 && (await device.read(...failed));
  dispatch(updateProps([id, ids.map(Math.abs)]));
});

const devicesSlice = createSlice({
  name: 'devices',
  initialState: devicesAdapter.getInitialState(),
  reducers: {
    addDevice(state, { payload: id }: PayloadAction<DeviceId>) {
      const device = findDeviceById(id);
      if (!device) {
        console.error(`unknown Device id: ${id}`);
        return;
      }
      const { address, connection } = device;

      const entity: DeviceState = {
        id,
        address: address.toString(),
        connected: !!connection,
        path: connection?.path,
        mib: Reflect.getMetadata('mib', device),
        isEmptyAddress: address.isEmpty,
        props: getProps(device),
        isBusy: 1,
        // session: connection?.session && getSessionId(connection.session),
      };

      if (connection?.owner === device) {
        entity.isLinkingDevice = connection.description.link;
        entity.category = connection.description.category;
      }

      devicesAdapter.addOne(state, entity);
    },
    removeDevice(state, { payload: id }: PayloadAction<DeviceId>) {
      devicesAdapter.removeOne(state, id);
    },
    setConnected(state, { payload: id }: PayloadAction<DeviceId>) {
      const device = findDeviceById(id);
      if (!device) return;
      const { connection } = device;
      devicesAdapter.updateOne(state, {
        id,
        changes: {
          connected: !!connection,
          // session: connection?.session && getSessionId(connection.session),
        },
      });
    },
    updateProperty(state, { payload: [id, name] }: PayloadAction<[DeviceId, string]>) {
      const device = findDeviceById(id);
      if (!device) return;
      const [propName, propValue] = getDeviceProp(device)(name);
      const entity = state.entities[id]; // selectById(state, id);
      if (entity) {
        entity.props = {
          ...entity.props,
          [propName]: propValue,
        };
      }
    },
    setParent(
      state,
      { payload: [id, parentId] }: PayloadAction<[id: DeviceId, parentId: DeviceId]>
    ) {
      devicesAdapter.updateOne(state, {
        id,
        changes: { parent: parentId },
      });
    },
    setDeviceError(state, { payload: [id, error] }: PayloadAction<[id: DeviceId, error?: string]>) {
      devicesAdapter.updateOne(state, {
        id,
        changes: { error },
      });
    },
    changeAddress(
      state,
      { payload: [id, address] }: PayloadAction<[id: DeviceId, address: string]>
    ) {
      devicesAdapter.updateOne(state, {
        id,
        changes: { address },
      });
    },
    deviceReady(state, { payload: id }: PayloadAction<DeviceId>) {
      const entity = state.entities[id];
      if (!entity) return;
      devicesAdapter.updateOne(state, {
        id,
        changes: {
          isBusy: entity.isBusy - 1,
        },
      });
    },
    // releaseDevice(state, { payload: id }: PayloadAction<DeviceId>) {
    //   const device = findDeviceById(id);
    //   device && device.release();
    // },
  },
  extraReducers: builder => {
    builder.addCase(
      updateProps,
      (state, { payload: [id, ids] }: PayloadAction<[id: DeviceId, ids?: number[]]>) => {
        const device = findDeviceById(id);
        const entity = state.entities[id];
        if (!device || !entity) return;
        devicesAdapter.updateOne(state, {
          id,
          changes: {
            props: { ...entity.props, ...getProps(device, ids) },
          },
        });
      }
    );
    builder.addCase(reloadDevice.pending, (state, { meta: { arg: id } }) => {
      const entity = state.entities[id];
      if (entity) {
        entity.isBusy += 1;
      }
    });
    builder.addCase(reloadDevice.fulfilled, (state, { meta: { arg: id } }) => {
      const entity = state.entities[id];
      if (entity) {
        entity.isBusy -= 1;
        entity.error = undefined;
      }
    });
    builder.addCase(reloadDevice.rejected, (state, { error, meta: { arg: id } }) => {
      const entity = state.entities[id];
      if (entity) {
        entity.isBusy -= 1;
        entity.error = error.message;
      }
    });
    builder.addCase(
      drainDevice.pending,
      (
        state,
        {
          meta: {
            arg: [id],
          },
        }
      ) => {
        const entity = state.entities[id];
        if (entity) {
          entity.isBusy += 1;
        }
      }
    );
    builder.addCase(
      drainDevice.fulfilled,
      (
        state,
        {
          meta: {
            arg: [id],
          },
        }
      ) => {
        const entity = state.entities[id];
        if (entity) {
          entity.isBusy -= 1;
        }
      }
    );
    builder.addCase(
      drainDevice.rejected,
      (
        state,
        {
          meta: {
            arg: [id],
          },
        }
      ) => {
        const entity = state.entities[id];
        if (entity) {
          entity.isBusy -= 1;
        }
      }
    );
  },
});

export const {
  selectAll: selectAllDevices,
  selectById: selectDeviceById,
  selectIds: selectDeviceIds,
} = devicesAdapter.getSelectors<RootState>(state => state.devices);

export const selectAllProps = (state: RootState, id: DeviceId): DeviceProps =>
  selectDeviceById(state, id)?.props ?? {};

export const selectProps = <P extends string>(
  state: RootState,
  id: DeviceId,
  ...names: P[]
): Record<P, ValueState | undefined> =>
  pick(selectAllProps(state, id) as Record<P, ValueState | undefined>, names);

export const selectLinkIds = (state: RootState): DeviceId[] =>
  Object.values(state.devices.entities)
    .filter(notEmpty)
    .filter(({ isLinkingDevice }) => isLinkingDevice)
    .map(({ id }) => id);

export const selectLinks = (state: RootState): DeviceState[] =>
  selectLinkIds(state)
    .map(id => selectDeviceById(state, id))
    .filter(notEmpty);

export const selectAllDevicesWithParent = (state: RootState): DeviceStateWithParent[] =>
  selectAllDevices(state).map(({ parent, ...props }) => ({
    ...props,
    parent: typeof parent !== 'undefined' ? selectDeviceById(state, parent) : undefined,
  }));

export const filterDevicesByAddress = <D extends Pick<DeviceState, 'address' | 'mib' | 'props'>>(
  devices: D[],
  address: Address
): D[] =>
  devices.filter(device => {
    if (address.type === AddressType.mac) return address.equals(device.address);
    if (address.type === AddressType.net) {
      if (device.mib.startsWith('minihost')) {
        // debug(`${device.props.domain?.raw}.${device.props.subnet?.raw}.${device.props.did?.raw}`);
        return (
          address.domain === device.props.domain?.raw &&
          address.subnet === device.props.subnet?.raw &&
          address.device === device.props.did?.raw
        );
      }
      if (device.mib === 'mcdvi') {
        return (
          address.domain === 255 &&
          device.props.subnet?.raw === address.subnet &&
          address.device === device.props.did?.raw
        );
      }
    }
    return false;
  });

export const selectDevicesByAddress = createSelector(
  [selectAllDevices, (state, address: AddressParam) => new Address(address)],
  filterDevicesByAddress
);

const {
  // addDevice,
  // removeDevice,
  setConnected,
  updateProperty,
  setParent,
  // setDeviceError,
  changeAddress,
  deviceReady,
} = devicesSlice.actions;

export const { addDevice, removeDevice } = devicesSlice.actions;
export const setDeviceValue = (
  deviceId: DeviceId
): ((name: string, value: ValueType) => AppThunk) => {
  const device = findDeviceById(deviceId);
  if (!device) {
    console.error(`Unknown device ${deviceId}`);
    return () => () => {};
  }
  const proto = Reflect.getPrototypeOf(device);
  const propNames = (
    (Reflect.getMetadata('mibProperties', proto!) as string[]) ?? []
  ).filter(name => Reflect.getMetadata('isWritable', proto!, name));
  const drain = debounce((dispatch: AppDispatch): void => {
    dispatch(drainDevice(deviceId));
  }, 400);

  return (name, value) => dispatch => {
    if (!propNames.includes(name)) {
      console.error(`Unknown property ${name}`);
      // console.log({ propNames });
      return;
    }
    device[name] = value;
    dispatch(updateProperty([deviceId, name]));
    drain(dispatch);
  };
};

export const createDevice = (
  parent: DeviceId,
  address: string,
  type: number,
  version?: number
): AppThunk => dispatch => {
  const session = getCurrentNibusSession();
  const device = session.devices.create(address, type!, version);
  const parentDevice = session.devices.findById(parent);
  if (parentDevice) {
    device.connection = parentDevice.connection;
    const checkConnection = async (): Promise<void> => {
      await session.pingDevice(device);
    };
    const timer = window.setInterval(checkConnection, 10000);
    device.once('release', () => window.clearInterval(timer));
  }
  setImmediate(() => {
    dispatch(setParent([device.id, parent]));
  });
};

const isSlaveMinihostOrMcdvi = (info?: VersionInfo): boolean =>
  Boolean(
    info && ((info.type === MINIHOST_TYPE && info.connection.owner) || info.type === MCDVI_TYPE)
  );

const pinger = (session: INibusSession): AppThunk => (dispatch, getState) => {
  const state = getState();
  const isReady = !selectAllDevices(state).some(({ isBusy }) => isBusy);
  if (!isReady) {
    window.setTimeout(() => dispatch(pinger(session)), 300);
    return;
  }
  const inaccessibleAddresses = selectScreenAddresses(state).filter(
    address => selectDevicesByAddress(state, address).length === 0
  );
  if (inaccessibleAddresses.length === 0) return;
  Promise.all(
    inaccessibleAddresses.map(async address => tuplify(await session.ping(address), address))
  ).then(res =>
    res
      .filter(([[timeout, info]]) => timeout > 0 && isSlaveMinihostOrMcdvi(info))
      .forEach(([[, info], address]) => {
        // debug(`source: ${info?.source}`);
        dispatch(createDevice(info!.connection.owner!.id, address, info!.type, info!.version));
      })
  );
};

let pingerTimer = 0;

export const initializeDevices: AsyncInitializer = (dispatch, getState: () => RootState) => {
  if (!isRemoteSession && !pingerTimer) {
    const session = getCurrentNibusSession();
    pingerTimer = window.setInterval(() => dispatch(pinger(session)), PINGER_INTERVAL);
  }
  const newDeviceHandler = (device: IDevice): void => {
    const { id: deviceId } = device;
    const mib = Reflect.getMetadata('mib', device);
    const connectedHandler = (): void => {
      dispatch(setConnected(deviceId));
      dispatch(reloadDevice(deviceId));
    };
    const disconnectedHandler = (): void => {
      /*
      try {
        const current = selectCurrentDeviceId(getState());
        if (current === deviceId) {
          dispatch(setCurrentDevice(undefined));
        }
      } catch (e) {
        console.error(`error while disconnect: ${e.message}`);
      }
*/
      device.release();
    };
    const addressHandler = (prev: Address, address: Address): void => {
      dispatch(changeAddress([deviceId, address.toString()]));
    };
    const releaseHandler = (): void => {
      device.off('connected', connectedHandler);
      device.off('disconnected', disconnectedHandler);
      device.off('release', releaseHandler);
      device.off('addressChanged', addressHandler);
    };
    device.on('connected', connectedHandler);
    device.on('disconnected', disconnectedHandler);
    device.on('release', releaseHandler);
    device.on('addressChanged', addressHandler);

    dispatch(addMib(deviceId));
    // isBusy = 1
    dispatch(addDevice(deviceId));
    setTimeout(() => {
      if (!device.connection) return;
      device.read().finally(() => {
        dispatch(updateProps([deviceId]));
        dispatch(deviceReady(deviceId));
        // debug(`deviceReady ${device.address.toString()}`);
        // selectCurrentDeviceId(getState()) || dispatch(setCurrentDevice(deviceId));
        const brightness = selectBrightness(getState());
        const setValue = setDeviceValue(deviceId);
        if (mib?.startsWith('minihost') || mib === 'mcdvi') {
          setValue('brightness', brightness);
        }
        dispatch(initializeScreens());
      });
    }, 3000);
  };
  const deleteDeviceHandler = (device: IDevice): void => {
    try {
      /*
      const current = selectCurrentDeviceId(getState());
      if (current === device.id) {
        dispatch(setCurrentDevice(undefined));
      }
*/
      dispatch(removeDevice(device.id));
    } catch (e) {
      console.error(e.message);
    }
  };
  const session = getCurrentNibusSession();
  session.devices.on('new', newDeviceHandler);
  session.devices.on('delete', deleteDeviceHandler);
  return () => {
    session.devices.off('new', newDeviceHandler);
    session.devices.off('delete', deleteDeviceHandler);
  };
};

export default devicesSlice.reducer;