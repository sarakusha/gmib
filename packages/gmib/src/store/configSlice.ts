/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { LogLevel } from '@nibus/core';
import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import debounce from 'lodash/debounce';
import semverLt from 'semver/functions/lt';
import {
  Config,
  convertCfgTo,
  defaultScreen,
  Location,
  Page,
  Screen,
  OverheatProtection,
  validateConfig,
  DEFAULT_OVERHEAD_PROTECTION,
} from '../util/config';
import { findById, PropPayload, PropPayloadAction } from '../util/helpers';
import { getCurrentNibusSession } from '../util/nibus';
import type { RootState } from './index';

// const debug = debugFactory('gmib:configSlice');

export interface ConfigState extends Config {
  loading: boolean;
}

const initialState: ConfigState = {
  brightness: 30,
  autobrightness: false,
  spline: undefined,
  screens: [],
  logLevel: 'none',
  pages: [],
  version: undefined,
  loading: true,
  overheatProtection: DEFAULT_OVERHEAD_PROTECTION,
};

export const sendConfig = debounce((state: ConfigState): void => {
  const { loading, ...config } = state;
  const session = getCurrentNibusSession();
  if (!validateConfig(config)) console.warn(`error while validate config`);
  const cfg =
    !config.version || semverLt(config.version, '3.1.0') ? convertCfgTo(config) : { ...config };
  session.saveConfig(cfg);
}, 500);

export const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    showHttpPage(state, { payload: [scrId, pageId] }: PayloadAction<[string, string | undefined]>) {
      const screen = findById(state.screens, scrId);
      if (screen) {
        screen.output = pageId;
        sendConfig(current(state));
      }
    },
    setBrightness(state, { payload: brightness }: PayloadAction<number>) {
      state.brightness = Math.round(Math.max(Math.min(brightness, 100), 0));
      sendConfig(current(state));
    },
    setAutobrightness(state, { payload: on }: PayloadAction<boolean>) {
      state.autobrightness = on;
      sendConfig(current(state));
    },
    setSpline(state, { payload: spline }: PayloadAction<Config['spline']>) {
      state.spline = spline;
      sendConfig(current(state));
    },
    setLocationProp(state, { payload: [prop, value] }: PropPayloadAction<Location>) {
      if (!state.location) state.location = {};
      state.location[prop] = value;
      sendConfig(current(state));
    },
    setScreenProp(
      state,
      { payload: [scrId, [prop, value]] }: PayloadAction<[string, PropPayload<Screen>]>
    ) {
      const screen = findById(state.screens, scrId);
      if (!screen) return;
      screen[prop] = value as never;
      sendConfig(current(state));
    },
    updateConfig(state, { payload: config }: PayloadAction<Config>) {
      Object.assign(state, config);
      state.loading = false;
    },
    setLogLevel(state, { payload: logLevel }: PayloadAction<LogLevel>) {
      const session = getCurrentNibusSession();
      state.logLevel = logLevel;
      session.setLogLevel(logLevel);
      sendConfig(current(state));
    },
    upsertHttpPage(state, { payload: page }: PayloadAction<Page>) {
      const found = findById(state.pages, page.id);
      if (found) {
        Object.assign(found, page);
      } else {
        state.pages.push(page);
      }
      sendConfig(current(state));
    },
    removeHttpPage(state, { payload: id }: PayloadAction<string>) {
      state.pages = state.pages.filter(page => page.id !== id);
      sendConfig(current(state));
    },

    addAddress(state, { payload: [scrId, address] }: PayloadAction<[string, string]>) {
      const screen = findById(state.screens, scrId);
      if (!screen) return;
      if (!screen.addresses) screen.addresses = [];
      screen.addresses = [...screen.addresses, address];
      sendConfig(current(state));
    },
    removeAddress(
      state,
      { payload: [scrId, chip, index] }: PayloadAction<[string, string, number]>
    ) {
      const screen = findById(state.screens, scrId);
      if (!screen?.addresses) return;
      if (screen.addresses[index] === chip) screen.addresses.splice(index, 1);
      sendConfig(current(state));
    },
    addScreen(state, { payload: [id, name] }: PayloadAction<[string, string]>) {
      state.screens.push({ ...defaultScreen, id, name });
      sendConfig(current(state));
    },
    removeScreen(state, { payload: id }: PayloadAction<string>) {
      const index = state.screens.findIndex(screen => screen.id === id);
      if (index !== -1) {
        state.screens.splice(index, 1);
        if (state.screens.length === 1) {
          state.screens[0].brightnessFactor = 1;
        }
        sendConfig(current(state));
      }
    },
    // setOverheatProtection(
    //   state,
    //   { payload: overheatProtection }: PayloadAction<OverheatProtection>
    // ) {
    //   state.overheatProtection = overheatProtection;
    //   sendConfig(current(state));
    // },
    setProtectionProp(state, { payload: [name, value] }: PropPayloadAction<OverheatProtection>) {
      if (!state.overheatProtection) state.overheatProtection = DEFAULT_OVERHEAD_PROTECTION;
      Object.assign(state.overheatProtection, { [name]: value });
      sendConfig(current(state));
    },
  },
});

export const selectConfig = (state: RootState): ConfigState => state.config;

export const selectLoading = (state: RootState): boolean => selectConfig(state).loading;

export const selectBrightness = (state: RootState): number => selectConfig(state).brightness;

export const selectAutobrightness = (state: RootState): boolean =>
  selectConfig(state).autobrightness;

export const selectSpline = (state: RootState): Config['spline'] => selectConfig(state).spline;

export const selectLocation = (state: RootState): Config['location'] =>
  selectConfig(state).location;

export const selectScreens = (state: RootState): Screen[] => selectConfig(state).screens;

export const selectScreenById = (state: RootState, id?: string): Screen | undefined =>
  (id && findById(selectConfig(state).screens, id)) || undefined;

export const selectLogLevel = (state: RootState): LogLevel => selectConfig(state).logLevel;

export const selectAllPages = (state: RootState): Page[] => selectConfig(state).pages;

export const selectPageById = (state: RootState, id: string): Page | undefined =>
  findById(selectAllPages(state), id);

export const selectSessionVersion = (state: RootState): string | undefined =>
  selectConfig(state).version;

export const selectScreenAddresses = (state: RootState): string[] =>
  [
    ...new Set(
      selectScreens(state).reduce<string[]>(
        (res, { addresses }) =>
          addresses ? [...res, ...addresses.map(address => address.replace(/[+-].*$/, ''))] : res,
        []
      )
    ),
  ].sort();

export const selectOverheatProtection = (state: RootState): OverheatProtection | undefined =>
  selectConfig(state).overheatProtection;

export const {
  addScreen,
  removeScreen,
  showHttpPage,
  setAutobrightness,
  setSpline,
  setLocationProp,
  setLogLevel,
  upsertHttpPage,
  removeHttpPage,
  addAddress,
  removeAddress,
  updateConfig,
  setBrightness,
  // setOverheatProtection,
  setProtectionProp: setProtectionPropImpl,
} = configSlice.actions;

export default configSlice.reducer;
