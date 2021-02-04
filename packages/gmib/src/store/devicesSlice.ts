/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import session, { Address, AddressParam, IDevice } from '@nibus/core';
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
import { notEmpty } from '../util/helpers';
import type { AppDispatch, AppThunk, RootState } from './index';

type ValueStatus = 'succeeded' | 'failed' | 'pending';
export type DeviceId = string;
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
  isLink?: boolean;
  error?: string;
  isBusy: number;
};

export type DeviceStateWithParent = Omit<DeviceState, 'parent'> & { parent?: DeviceState };

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

const getProps = (device: IDevice, idsOrNames?: (number | string)[]): DeviceState['props'] => {
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

const { selectById } = devicesAdapter.getSelectors();

const updateProps = createAction<[id: DeviceId, ids?: number[]]>('devices/updateProps');

export const reloadDevice = createAsyncThunk<void, DeviceId>(
  'devices/reload',
  async (id, { dispatch }) => {
    const device = session.devices.findById(id);
    if (device?.connection) {
      await device.read();
      dispatch(updateProps([id]));
    }
  }
);

const drainDevice = createAsyncThunk<void, DeviceId>('devices/drain', async (id, { dispatch }) => {
  const device = session.devices.findById(id);
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
    deviceUpdated: devicesAdapter.updateOne,
    addDevice(state, { payload: id }: PayloadAction<DeviceId>) {
      const device = session.devices.findById(id);
      if (!device) return;
      const { address, connection } = device;

      const entity: DeviceState = {
        id,
        address: address.toString(),
        connected: !!connection,
        path: connection?.path,
        mib: Reflect.getMetadata('mib', device),
        isEmptyAddress: address.isEmpty,
        props: getProps(device),
        isBusy: 0,
      };

      if (connection?.owner === device) {
        entity.isLink = connection.description.link;
        entity.category = connection.description.category;
      }

      devicesAdapter.addOne(state, entity);
    },
    removeDevice(state, { payload: id }: PayloadAction<DeviceId>) {
      const entity = selectById(state, id);
      if (entity) {
        devicesAdapter.removeOne(state, id);
        const device = session.devices.findById(id);
        device && device.release();
      }
    },
    setConnected(state, { payload: id }: PayloadAction<DeviceId>) {
      const device = session.devices.findById(id);
      if (!device) return;
      const { connection } = device;
      devicesAdapter.updateOne(state, { id, changes: { connected: !!connection } });
    },
    updateProperty(state, { payload: [id, name] }: PayloadAction<[DeviceId, string]>) {
      const device = session.devices.findById(id);
      if (!device) return;
      const [propName, propValue] = getDeviceProp(device)(name);
      const entity = state.entities[id]; // selectById(state, id);
      if (entity) {
        entity.props = { ...entity.props, [propName]: propValue };
      }
    },
    setParent(
      state,
      { payload: [id, parentId] }: PayloadAction<[id: DeviceId, parentId: DeviceId]>
    ) {
      devicesAdapter.updateOne(state, { id, changes: { parent: parentId } });
    },
    setDeviceError(state, { payload: [id, error] }: PayloadAction<[id: DeviceId, error?: string]>) {
      devicesAdapter.updateOne(state, { id, changes: { error } });
    },
    changeAddress(
      state,
      { payload: [id, address] }: PayloadAction<[id: DeviceId, address: string]>
    ) {
      devicesAdapter.updateOne(state, { id, changes: { address } });
    },
  },
  extraReducers: builder => {
    builder.addCase(
      updateProps,
      (state, { payload: [id, ids] }: PayloadAction<[id: DeviceId, ids?: number[]]>) => {
        const device = session.devices.findById(id);
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

export const selectAllDevicesWithParent = (state: RootState): DeviceStateWithParent[] =>
  selectAllDevices(state).map(({ parent, ...props }) => ({
    ...props,
    parent: typeof parent !== 'undefined' ? selectDeviceById(state, parent) : undefined,
  }));

export const selectDevicesByAddress = createSelector(
  [selectAllDevices, (state, address: AddressParam) => new Address(address)],
  (devices, address) => devices.filter(device => address.equals(device.address))
);

export const {
  addDevice,
  removeDevice,
  setConnected,
  updateProperty,
  setParent,
  deviceUpdated,
  setDeviceError,
  changeAddress,
} = devicesSlice.actions;

export const setDeviceValue = (
  deviceId: DeviceId
): ((name: string, value: ValueType) => AppThunk) => {
  const device = session.devices.findById(deviceId);
  if (!device) throw new Error(`Unknown device ${deviceId}`);
  const proto = Reflect.getPrototypeOf(device);
  const propNames = ((Reflect.getMetadata('mibProperties', proto) as string[]) ?? []).filter(name =>
    Reflect.getMetadata('isWritable', proto, name)
  );
  const drain = debounce((dispatch: AppDispatch): void => {
    dispatch(drainDevice(deviceId));
  }, 400);

  return (name, value) => dispatch => {
    if (!propNames.includes(name)) {
      console.error(`Unknown property ${name}`);
      return;
    }
    device[name] = value;
    dispatch(updateProperty([deviceId, name]));
    drain(dispatch);
  };
};

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
    .filter(({ isLink }) => isLink)
    .map(({ id }) => id);

export const selectLinks = (state: RootState): DeviceState[] =>
  selectLinkIds(state)
    .map(id => selectDeviceById(state, id))
    .filter(notEmpty);

export default devicesSlice.reducer;
