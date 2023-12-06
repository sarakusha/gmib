import type { PayloadAction } from '@reduxjs/toolkit';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import type { ValueType } from '/@common/helpers';

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

export const mibsAdapter = createEntityAdapter<MibInfo, string>({ selectId: mib => mib.name });

const mibsSlice = createSlice({
  name: 'mibs',
  initialState: mibsAdapter.getInitialState(),
  reducers: {
    addMib(state, { payload: mib }: PayloadAction<MibInfo>) {
      const entity = state.entities[mib.name];
      if (entity) return;
      mibsAdapter.addOne(state, mib);
    },
    removeMib: mibsAdapter.removeOne,
  },
});

export const { addMib, removeMib } = mibsSlice.actions;

export default mibsSlice;
