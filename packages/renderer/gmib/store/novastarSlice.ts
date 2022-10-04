import type { ChipTypeEnum } from '@novastar/native/ChipType';
import type { TestModeEnum } from '@novastar/native/TestMode';
import type { BrightnessRGBV } from '@novastar/screen/ScreenConfigurator';
import type { DeviceInfo } from '@novastar/screen/DeviceInfo';
import type { LEDDisplayInfo } from '@novastar/screen/common';

import type { Draft, EntityState, PayloadAction } from '@reduxjs/toolkit';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import { minmax } from '/@common/helpers';
// import debugFactory from 'debug';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:novastar`);

export type ScreenId = {
  path: string;
  screen: number;
};

export type Screen = {
  info: LEDDisplayInfo;
  mode?: TestModeEnum | null;
  rgbv?: BrightnessRGBV | null;
  gamma?: number | null;
  chipType?: ChipTypeEnum | null;
};

export type Novastar = {
  path: string;
  hasDVISignalIn?: boolean;
  info?: Readonly<DeviceInfo>;
  screens?: ReadonlyArray<Screen>;
  isBusy: number;
  connected: boolean;
  error?: string;
};

export type ScreenParam<K extends keyof Screen> = ScreenId & {
  name: K;
  value: Screen[K];
};

export type ScreenArg<K extends keyof Screen> = Omit<ScreenParam<K>, 'name'>;

type ScreenColorBrightness = ScreenId & {
  color: keyof BrightnessRGBV;
  value: number;
};

export type ScreenBrightness = ScreenId & {
  percent: number;
};

export const novastarAdapter = createEntityAdapter<Novastar>({ selectId: ({ path }) => path });

const novastarSlice = createSlice({
  name: 'novastar',
  initialState: novastarAdapter.getInitialState(),
  reducers: {
    addNovastar: novastarAdapter.addOne,
    removeNovastar: novastarAdapter.removeOne,
    updateNovastar: novastarAdapter.updateOne,
    novastarBusy(state, { payload: path }: PayloadAction<string>) {
      const entity = state.entities[path];
      if (!entity) return;
      novastarAdapter.updateOne(state, {
        id: path,
        changes: {
          isBusy: entity.isBusy + 1,
        },
      });
    },
    novastarReady(state, { payload: path }: PayloadAction<string>) {
      const entity = state.entities[path];
      if (!entity) return;
      novastarAdapter.updateOne(state, {
        id: path,
        changes: {
          isBusy: entity.isBusy - 1,
        },
      });
    },
    updateScreen<K extends keyof Screen>(
      state: Draft<EntityState<Novastar>>,
      { payload: { path, screen, name, value } }: PayloadAction<ScreenParam<K>>,
    ) {
      const entity = state.entities[path];
      if (entity?.screens?.[screen]) {
        entity.screens[screen][name] = value;
      }
    },
    setScreenColorBrightness(
      state,
      { payload: { path, screen, color, value } }: PayloadAction<ScreenColorBrightness>,
    ) {
      const rgbv = state.entities[path]?.screens?.[screen]?.rgbv;
      if (rgbv) {
        rgbv[color] = minmax(255, value);
      }
    },
    // findNetNovastarDevices: () => {
    //   window.novastar.findNetDevices();
    // },
    // releaseNovastars: novastarsAdapter.removeAll,
  },
  /*
    extraReducers: builder => {
      builder.addCase(reloadNovastar.pending, (state, { meta: { arg: path } }) => {
        const entity = state.entities[path];
        if (entity) {
          entity.isBusy += 1;
        }
      });
      builder.addCase(reloadNovastar.fulfilled, (state, { meta: { arg: path } }) => {
        const entity = state.entities[path];
        if (entity) {
          entity.isBusy -= 1;
          entity.error = undefined;
        }
      });
      builder.addCase(reloadNovastar.rejected, (state, { error, meta: { arg: path } }) => {
        const entity = state.entities[path];
        // console.log({ error });
        if (entity) {
          entity.isBusy -= 1;
          entity.error = error.message;
          entity.info = undefined;
          entity.screens = undefined;
          entity.hasDVISignalIn = false;
        }
      });
      builder.addCase('novastars/removeAll', () => {
        window.novastar.closeAll();
        // Object.values(novastarControls).forEach(novastarSession => novastarSession?.session.close());
      });
    },
  */
});

export const {
  addNovastar,
  removeNovastar,
  novastarBusy,
  novastarReady,
  setScreenColorBrightness,
  updateNovastar,
  updateScreen,
} = novastarSlice.actions;

export default novastarSlice.reducer;
