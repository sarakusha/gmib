import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { OptionsObject, SnackbarMessage } from 'notistack';

import type { DeviceId, Kind } from '@nibus/core';

export type FlasherState = {
  progress: number;
  flashing: boolean;
};

const initialState: FlasherState = {
  progress: 0,
  flashing: false,
};

type SnackbarArgs = {
  message: SnackbarMessage;
  options?: OptionsObject;
  kind: Kind;
  filename: string;
  id: DeviceId;
};

const flasherSlice = createSlice({
  name: 'flasher',
  initialState,
  reducers: {
    setProgress(state, { payload: progress }: PayloadAction<number>) {
      state.progress = progress;
    },
    setFlashing(state, { payload: flashing }: PayloadAction<boolean>) {
      state.flashing = flashing;
    },
    enqueueSnackbar(_, __: PayloadAction<SnackbarArgs>) {},
  },
});

export const { enqueueSnackbar, setFlashing, setProgress } = flasherSlice.actions;

export default flasherSlice.reducer;
