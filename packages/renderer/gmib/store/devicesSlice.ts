import type { DeviceId } from '@nibus/core';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import type { ValueState, ValueType } from '/@common/helpers';

// import debugFactory from '../util/debug';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:devicesSlice`);

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

export const devicesAdapter = createEntityAdapter<DeviceState, string>({
  selectId: device => device.id,
});

const { selectAll } = devicesAdapter.getSelectors();

const devicesSlice = createSlice({
  name: 'devices',
  initialState: devicesAdapter.getInitialState(),
  reducers: {
    addDevice: devicesAdapter.addOne,
    removeDevice: devicesAdapter.removeOne,
    setConnected(state, { payload: [id, connected] }: PayloadAction<[DeviceId, boolean]>) {
      devicesAdapter.updateOne(state, { id, changes: { connected } });
    },
    updateProps(state, { payload: [id, props] }: PayloadAction<[DeviceId, DeviceProps]>) {
      const entity = state.entities[id];
      if (entity) {
        entity.props = {
          ...entity.props,
          ...props,
        };
      }
    },
    updateProperty(
      state,
      { payload: [id, name, value] }: PayloadAction<[DeviceId, string, ValueState]>,
    ) {
      const entity = state.entities[id];
      if (entity) {
        entity.props[name] = value;
      }
    },
    setParent(
      state,
      { payload: [id, parentId] }: PayloadAction<[id: DeviceId, parentId: DeviceId]>,
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
      { payload: [id, address] }: PayloadAction<[id: DeviceId, address: string]>,
    ) {
      devicesAdapter.updateOne(state, {
        id,
        changes: { address },
      });
    },
    deviceBusy(state, { payload: id }: PayloadAction<DeviceId>) {
      const entity = state.entities[id];
      if (!entity) return;
      devicesAdapter.updateOne(state, {
        id,
        changes: {
          isBusy: entity.isBusy + 1,
        },
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
    connectionClosed(state, { payload: path }: PayloadAction<string>) {
      const ids = selectAll(state)
        .filter(device => device.path === path)
        .map(({ id }) => id);
      // ids.forEach(id => this.removeDevice(state, id)); // side effect
      devicesAdapter.removeMany(state, ids);
    },
    // releaseDevice(state, { payload: id }: PayloadAction<DeviceId>) {
    //   const device = findDeviceById(id);
    //   device && device.release();
    // },
  },
  // extraReducers: builder => {
  // builder.addCase(
  //   updateProps,
  //   (state, { payload: [id, ids] }: PayloadAction<[id: DeviceId, ids?: number[]]>) => {
  //     // const device = window.nibus.findDeviceById(id);
  //     const entity = state.entities[id];
  //     if (!device || !entity) return;
  //     devicesAdapter.updateOne(state, {
  //       id,
  //       changes: {
  //         props: { ...entity.props, ...getProps(device, ids) },
  //       },
  //     });
  //   },
  // );
  /*
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
  */
  /*
      builder.addCase(
        drainDevice.pending,
        (
          state,
          {
            meta: {
              arg: [id],
            },
          },
        ) => {
          const entity = state.entities[id];
          if (entity) {
            entity.isBusy += 1;
          }
        },
      );
      builder.addCase(
        drainDevice.fulfilled,
        (
          state,
          {
            meta: {
              arg: [id],
            },
          },
        ) => {
          const entity = state.entities[id];
          if (entity) {
            entity.isBusy -= 1;
          }
        },
      );
      builder.addCase(
        drainDevice.rejected,
        (
          state,
          {
            meta: {
              arg: [id],
            },
          },
        ) => {
          const entity = state.entities[id];
          if (entity) {
            entity.isBusy -= 1;
          }
        },
      );
  */
  // },
});

export const {
  addDevice,
  removeDevice,
  setConnected,
  changeAddress,
  deviceBusy,
  deviceReady,
  setParent,
  updateProperty,
  updateProps,
  connectionClosed,
} = devicesSlice.actions;

export default devicesSlice;
