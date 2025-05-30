/* eslint-disable no-param-reassign */
import type { LogLevel } from '@nibus/core';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Config, HidOptions, Location, OverheatProtection } from '/@common/config';
import { DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import type { PropPayloadAction } from '/@common/helpers';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:configSlice`);

export type ConfigState = Config & {
  loading: boolean;
};

const initialState: ConfigState = {
  brightness: 30,
  autobrightness: false,
  spline: undefined,
  logLevel: 'none',
  version: undefined,
  loading: true,
  overheatProtection: DEFAULT_OVERHEAD_PROTECTION,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    // TODO: !
    // showHttpPage(state, { payload: [scrId, pageId] }: PayloadAction<[number, string | undefined]>) {
    // const screen = findById(state.screens, scrId);
    // if (screen) {
    //   screen.output = pageId;
    // }
    // },
    setBrightness(state, { payload: brightness }: PayloadAction<number>) {
      state.brightness = Math.round(Math.max(Math.min(brightness, 100), 0));
    },
    setAutobrightness(state, { payload: on }: PayloadAction<boolean>) {
      state.autobrightness = on;
    },
    setSpline(state, { payload: spline }: PayloadAction<Config['spline']>) {
      state.spline = spline;
    },
    setLocationProp(state, { payload: [prop, value] }: PropPayloadAction<Location>) {
      if (!state.location) state.location = {};
      state.location[prop] = value;
    },
    setHidProp(state, { payload: [prop, value] }: PropPayloadAction<HidOptions>) {
      if (!state.hid) state.hid = {};
      state.hid[prop] = value;
    },
    brightnessUp(state) {
      if (state.hid) {
        state.hid.brightness = Math.min((state.hid.brightness ?? 0) + 1, 100);
      }
    },
    brightnessDown(state) {
      if (state.hid) {
        state.hid.brightness = Math.max(
          (state.hid.brightness ?? 0) - 1,
          state.hid.minBrightness ?? 0,
        );
      }
    },
    /*
        setScreenProp(
          state,
          { payload: [scrId, [prop, value]] }: PayloadAction<[string, PropPayload<Screen>]>,
        ) {
          const screen = findById(state.screens, scrId);
          if (!screen) return;
          screen[prop] = value as never;
        },
    */
    updateConfig(state, { payload: config }: PayloadAction<Config>) {
      Object.assign(state, config);
      state.loading = false;
    },
    setLogLevel(state, { payload: logLevel }: PayloadAction<LogLevel>) {
      state.logLevel = logLevel;
    },

    /*
        addAddress(state, { payload: [scrId, address] }: PayloadAction<[string, string]>) {
          const screen = findById(state.screens, scrId);
          if (!screen) return;
          if (!screen.addresses) screen.addresses = [];
          screen.addresses = [...screen.addresses, address];
        },
        removeAddress(
          state,
          { payload: [scrId, chip, index] }: PayloadAction<[string, string, number]>,
        ) {
          const screen = findById(state.screens, scrId);
          if (!screen?.addresses) return;
          if (screen.addresses[index] === chip) screen.addresses.splice(index, 1);
        },
        addScreen(state, { payload: [id, name] }: PayloadAction<[string, string]>) {
          state.screens.push({ ...defaultScreen, id, name });
        },
        removeScreen(state, { payload: id }: PayloadAction<string>) {
          const index = state.screens.findIndex(screen => screen.id === id);
          if (index !== -1) {
            state.screens.splice(index, 1);
            if (state.screens.length === 1) {
              state.screens[0].brightnessFactor = 1;
            }
          }
        },
    */
    setProtectionProp(state, { payload: [name, value] }: PropPayloadAction<OverheatProtection>) {
      if (!state.overheatProtection) state.overheatProtection = DEFAULT_OVERHEAD_PROTECTION;
      Object.assign(state.overheatProtection, { [name]: value });
    },
    invalidateBrightness(_, __: PayloadAction<number>) {
      // side effect - appListener
    },
    setDisableNet(state, { payload }: PayloadAction<boolean>) {
      state.disableNet = payload;
    },
  },
});

export const {
  // addScreen,
  // removeScreen,
  // showHttpPage,
  setAutobrightness,
  setSpline,
  setLocationProp,
  setHidProp,
  setLogLevel,
  // addAddress,
  // removeAddress,
  updateConfig,
  setBrightness,
  // setScreenProp,
  setProtectionProp,
  invalidateBrightness,
  setDisableNet,
  brightnessDown,
  brightnessUp,
} = configSlice.actions;

export default configSlice;
