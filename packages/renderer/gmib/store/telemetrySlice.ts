import type { PayloadAction } from '@reduxjs/toolkit';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import type { CabinetInfo } from '/@common/helpers';

type NovastarTelemetryResult = {
  path: string;
  telemetry: CabinetInfo[];
  isLoading: boolean;
};

const novastarTelemetryAdapter = createEntityAdapter<NovastarTelemetryResult>({
  selectId: ({ path }) => path,
});

export const { selectById: selectNovastarTelemetryById } = novastarTelemetryAdapter.getSelectors();

const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState: { novastar: novastarTelemetryAdapter.getInitialState() },
  reducers: {
    startNovastarTelemetry(state, { payload: path }: PayloadAction<string>) {
      novastarTelemetryAdapter.setOne(state.novastar, { path, telemetry: [], isLoading: true });
    },
    addCabinetInfo(state, { payload: [path, info] }: PayloadAction<[string, CabinetInfo]>) {
      const entity = selectNovastarTelemetryById(state.novastar, path);
      novastarTelemetryAdapter.setOne(state.novastar, {
        path,
        telemetry: entity ? [...entity.telemetry, info] : [info],
        isLoading: true,
      });
    },
    finishNovastarTelemetry(state, { payload: path }: PayloadAction<string>) {
      const entity = selectNovastarTelemetryById(state.novastar, path);
      novastarTelemetryAdapter.setOne(state.novastar, {
        path,
        telemetry: entity?.telemetry ?? [],
        isLoading: false,
      });
    },
  },
});

export const { startNovastarTelemetry, addCabinetInfo, finishNovastarTelemetry } =
  telemetrySlice.actions;

export default telemetrySlice.reducer;
