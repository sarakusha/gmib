/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { DeviceId, findDeviceById } from '@nibus/core';
import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ValueType } from './devicesSlice';
import type { RootState } from './index';

export interface PropMetaInfo {
  id: number;
  displayName: string;
  isReadable: boolean;
  isWritable: boolean;
  type: string;
  simpleType: string;
  category?: string;
  rank?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  enumeration?: [string, number][];
  convertFrom?: (value: ValueType) => ValueType;
}

export interface MibInfo {
  name: string;
  properties: Record<string, PropMetaInfo>;
  disableBatchReading?: boolean;
}

const mibsAdapter = createEntityAdapter<MibInfo>({ selectId: mib => mib.name });

const { selectById } = mibsAdapter.getSelectors();

const mibsSlice = createSlice({
  name: 'mibs',
  initialState: mibsAdapter.getInitialState(),
  reducers: {
    addMib(state, { payload: id }: PayloadAction<DeviceId>) {
      const device = findDeviceById(id);
      if (!device) return;
      const mib = Reflect.getMetadata('mib', device);
      if (selectById(state, mib)) return;
      const proto = Reflect.getPrototypeOf(device) ?? {};
      const mibProperties = (Reflect.getMetadata('mibProperties', proto) ?? []) as string[];
      const properties = Object.fromEntries(
        mibProperties.map<[string, PropMetaInfo]>(name => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const getPropMeta = (key: string): any => Reflect.getMetadata(key, proto, name);
          return [
            name,
            {
              id: device.getId(name),
              displayName: getPropMeta('displayName'),
              isReadable: getPropMeta('isReadable'),
              isWritable: getPropMeta('isWritable'),
              type: getPropMeta('type'),
              simpleType: getPropMeta('simpleType'),
              category: getPropMeta('category'),
              rank: getPropMeta('rank'),
              unit: getPropMeta('unit'),
              min: getPropMeta('min'),
              max: getPropMeta('max'),
              step: getPropMeta('step'),
              enumeration: getPropMeta('enum'),
              convertFrom: getPropMeta('convertFrom'),
            } as PropMetaInfo,
          ];
        })
      );
      const mibInfo: MibInfo = {
        name: mib,
        properties,
        disableBatchReading: Reflect.getMetadata('disableBatchReading', proto),
      };
      mibsAdapter.addOne(state, mibInfo);
    },
    removeMib: mibsAdapter.removeOne,
  },
});

export const { addMib, removeMib } = mibsSlice.actions;

export const {
  selectAll: selectAllMibs,
  selectById: selectMibByName,
  selectIds: selectMibIds,
} = mibsAdapter.getSelectors<RootState>(state => state.mibs);

export default mibsSlice.reducer;
