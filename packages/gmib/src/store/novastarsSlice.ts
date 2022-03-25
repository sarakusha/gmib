/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Connection, series } from '@novastar/codec';
import { ChipTypeEnum } from '@novastar/native/build/main/generated/ChipType';
import { TestModeEnum } from '@novastar/native/build/main/generated/TestMode';
import net, { findNetDevices } from '@novastar/net';
import ScreenConfigurator, { BrightnessRGBV, DeviceInfo, LEDDisplayInfo } from '@novastar/screen';
import {
  Draft,
  EntityState,
  PayloadAction,
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';
import debugFactory from 'debug';
import { connect } from 'net';
import { minmax } from '../util/helpers';

import { isRemoteSession } from '../util/nibus';
import { AsyncInitializer } from './asyncInitialMiddleware';
import { selectBrightness, setBrightness } from './configSlice';
import createDebouncedAsyncThunk from './createDebouncedAsyncThunk';
import type { AppThunk, AppThunkConfig, RootState } from './index';
import { startAppListening } from './listenerMiddleware';
import { MIN_INTERVAL, pushSensorValue } from './sensorsSlice';

const debug = debugFactory('gmib:novastar');

const novastarControls: Record<string, ScreenConfigurator> = {};

export const getNovastarController = (path: string): ScreenConfigurator | undefined =>
  novastarControls[path];

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
  error?: string;
};

type ScreenParam<K extends keyof Screen> = ScreenId & {
  name: K;
  value: Screen[K];
};

type ScreenArg<K extends keyof Screen> = Omit<ScreenParam<K>, 'name'>;

type ScreenColorBrightness = ScreenId & {
  color: keyof BrightnessRGBV;
  value: number;
};

type ScreenBrightness = ScreenId & {
  percent: number;
};

const selectScreenId = ({ path, screen }: ScreenId): string => `${path}[${screen}]`;

const novastarsAdapter = createEntityAdapter<Novastar>({ selectId: ({ path }) => path });

export const {
  selectAll: selectAllNovastars,
  selectById: selectNovastarByPath,
  selectIds: selectNovastarIds,
} = novastarsAdapter.getSelectors<RootState>(state => state.novastars);

export const selectNovastarScreen = createSelector(
  [selectNovastarByPath, (_state, _path, screen: number) => screen],
  (novastar, screen) => novastar?.screens?.[screen]
);

export const reloadNovastar = createAsyncThunk<Promise<void>, string, AppThunkConfig>(
  'novastar/reload',
  async (path: string, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        removeNovastar(path)
      );
      return;
    }
    await controller.reload();
    const hasDVISignalIn = await controller.ReadHasDVISignalIn();
    if (hasDVISignalIn == null) {
      dispatch(
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        removeNovastar(path)
      );
      return;
    }
    const screens = await series(controller.screens, async (info, index) => {
      const screen: Screen = {
        info,
        mode: await controller.ReadFirstDisplayMode(index),
        rgbv: await controller.ReadFirstRGBVBrightness(index),
        gamma: await controller.ReadFirstGamma(index),
        chipType: await controller.ReadFirstChipType(index),
      };
      return screen;
    });
    dispatch(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      updateNovastar({
        id: path,
        changes: {
          path,
          info: controller.devices[0],
          screens,
          hasDVISignalIn,
        },
      })
    );
  }
);

const novastarsSlice = createSlice({
  name: 'novastars',
  initialState: novastarsAdapter.getInitialState(),
  reducers: {
    addNovastar: novastarsAdapter.addOne,
    removeNovastar: novastarsAdapter.removeOne,
    updateNovastar: novastarsAdapter.updateOne,
    novastarBusy(state, { payload: path }: PayloadAction<string>) {
      const entity = state.entities[path];
      if (!entity) return;
      novastarsAdapter.updateOne(state, {
        id: path,
        changes: {
          isBusy: entity.isBusy + 1,
        },
      });
    },
    novastarReady(state, { payload: path }: PayloadAction<string>) {
      const entity = state.entities[path];
      if (!entity) return;
      novastarsAdapter.updateOne(state, {
        id: path,
        changes: {
          isBusy: entity.isBusy - 1,
        },
      });
    },
    updateScreen<K extends keyof Screen>(
      state: Draft<EntityState<Novastar>>,
      { payload: { path, screen, name, value } }: PayloadAction<ScreenParam<K>>
    ) {
      const entity = state.entities[path];
      if (entity?.screens?.[screen]) {
        entity.screens[screen][name] = value;
      }
    },
    setScreenColorBrightness(
      state,
      { payload: { path, screen, color, value } }: PayloadAction<ScreenColorBrightness>
    ) {
      const entity = state.entities[path];
      if (entity?.screens?.[screen]?.rgbv) {
        entity.screens[screen].rgbv![color] = minmax(255, value);
      }
    },
    findNetNovastarDevices: () => {
      findNetDevices().then(addresses => {
        Object.entries(net.sessions)
          .filter(([address]) => !addresses.includes(address.split(':', 2)[0]))
          .forEach(([, session]) => session.close());
        addresses.forEach(address => net.open(address));
      });
    },
    releaseNovastars: novastarsAdapter.removeAll,
  },
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
    builder.addCase(`novastars/removeAll`, () => {
      Object.values(novastarControls).forEach(novastarSession => novastarSession?.session.close());
    });
  },
});

const { updateNovastar, updateScreen } = novastarsSlice.actions;
export const {
  addNovastar,
  removeNovastar,
  findNetNovastarDevices,
  releaseNovastars,
  novastarBusy,
  novastarReady,
  setScreenColorBrightness,
} = novastarsSlice.actions;

export const readLightSensor = createAsyncThunk<Promise<void>, string, AppThunkConfig>(
  'novastar/readLightSensor',
  async (path, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(removeNovastar(path));
      return;
    }
    const value = await controller.ReadFirstFuncCardLightSensor();
    // debug(`illuminance(${path}): ${value}`);
    value !== null && dispatch(pushSensorValue({ kind: 'illuminance', address: path, value }));
  }
);

export const updateHasDviIn = createAsyncThunk<Promise<void>, string, AppThunkConfig>(
  'novastar/updateHasDviIn',
  async (path, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(removeNovastar(path));
      return;
    }
    const hasDVISignalIn = await controller.ReadHasDVISignalIn();
    if (hasDVISignalIn == null) {
      dispatch(removeNovastar(path));
      return;
    }
    dispatch(
      updateNovastar({
        id: path,
        changes: {
          hasDVISignalIn,
        },
      })
    );
  }
);

export const setDisplayMode = createAsyncThunk<Promise<void>, ScreenArg<'mode'>, AppThunkConfig>(
  'novastar/setDisplayMode',
  async ({ path, screen, value }, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(removeNovastar(path));
      return;
    }
    if (value == null || (await controller.WriteDisplayMode(value, screen))) {
      dispatch(
        updateScreen({
          path,
          screen,
          name: 'mode',
          value,
        })
      );
    }
  }
);

export const setGamma = createAsyncThunk<Promise<void>, ScreenArg<'gamma'>, AppThunkConfig>(
  'novastar/setGamma',
  async ({ path, screen, value }, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(removeNovastar(path));
      return;
    }
    if (value == null || (await controller.WriteGamma(value, screen))) {
      dispatch(
        updateScreen({
          path,
          screen,
          name: 'gamma',
          value,
        })
      );
    }
  }
);

const updateColorBrightness = createDebouncedAsyncThunk<void, ScreenId>(
  'novastar/updateColorBrightness',
  async (payload, { dispatch, getState }) => {
    const { path, screen } = payload;
    const controller = novastarControls[path];
    if (!controller) {
      dispatch(removeNovastar(path));
      return;
    }
    const item = selectNovastarScreen(getState(), path, screen);
    const { rgbv } = item ?? {};
    if (!rgbv) return;
    await controller.WriteRGBVBrightness(rgbv, screen);
  },
  50,
  {
    maxWait: 300,
    selectId: selectScreenId,
  }
);

// export const setColorBrightness = ({
//   value,
//   ...props
// }: ScreenColorBrightness): AppThunk => dispatch => {
//   const payload = { value: minmax(255, value), ...props };
//   dispatch(setScreenColorBrightness(payload));
//   dispatch(changeColorBrightness(payload));
// };

startAppListening({
  actionCreator: setScreenColorBrightness,
  effect({ payload }, { dispatch, getOriginalState }) {
    const { path, screen, color, value } = payload;
    const scr = selectNovastarScreen(getOriginalState(), path, screen);
    if (scr?.rgbv?.[color] !== value) dispatch(updateColorBrightness(payload));
  },
});

/*
export const setAllNovastarBrightness = createAsyncThunk<Promise<void[]>, number, AppThunkConfig>(
  'novastar/setNovastarBrightness',
  (percent, { dispatch, getState }) =>
    Promise.all(
      selectAllNovastars(getState() as RootState)
        .map<Promise<void>>(async ({ path, screens = [] }) => {
          const controller = novastarControls[path];
          if (!controller) {
            dispatch(removeNovastar(path));
            return;
          }
          await series(screens, async (_, screen) => {
            await controller.WriteBrightness(percent, screen);
            const value = await controller.ReadFirstRGBVBrightness(screen);
            return dispatch(
              updateScreen({
                path,
                screen,
                name: 'rgbv',
                value,
              })
            );
          });
        })
        .filter(notEmpty)
    )
);
*/

export const setNovastarBrightness = createDebouncedAsyncThunk<void, ScreenBrightness>(
  'novastar/setNovastarBrightness',
  async ({ path, screen, percent }, { dispatch }) => {
    const controller = novastarControls[path];
    if (!controller) throw new Error(`Invalid novastar path: ${path}`);
    await controller.WriteBrightness(percent, screen);
    const screens = screen === -1 ? controller.screens.map((_, index) => index) : [screen];
    await series(screens, async scr => {
      const value = await controller.ReadFirstRGBVBrightness(scr);
      dispatch(
        updateScreen({
          path,
          screen: scr,
          name: 'rgbv',
          value,
        })
      );
    });
  },
  100,
  {
    maxWait: 500,
    leading: true,
    selectId: selectScreenId,
  }
);

export const createNovastarConnection = (
  path: string,
  port: number,
  host?: string
): AppThunk<Promise<void>> => (dispatch, getState) =>
  new Promise(resolve => {
    const socket = connect(port, host, () => {
      socket.write(path);
      window.setTimeout(async () => {
        const connection = new Connection(socket);
        const controller = new ScreenConfigurator(connection);
        novastarControls[path]?.session.close();
        novastarControls[path] = controller;
        dispatch(
          addNovastar({
            path,
            isBusy: 0,
          })
        );
        socket.once('close', () => {
          connection.close();
        });
        connection.once('close', () => {
          dispatch(removeNovastar(path));
          delete novastarControls[path];
          if (!socket.destroyed) socket.destroy();
        });
        await dispatch(reloadNovastar(path));
        const brightness = selectBrightness(getState());
        dispatch(
          setNovastarBrightness({
            path,
            screen: -1,
            percent: brightness,
          })
        );
        resolve();
      }, 100);
    });
  });

export const novastarInitializer: AsyncInitializer = (dispatch, getState) => {
  if (isRemoteSession) return;
  const openHandler = async (address: string): Promise<void> => {
    const session = net.sessions[address];
    if (!session) {
      debug(`Unknown session: ${address}`);
      return;
    }
    novastarControls[address] = new ScreenConfigurator(session);
    dispatch(
      addNovastar({
        path: address,
        isBusy: 0,
      })
    );
    await dispatch(reloadNovastar(address));
    const brightness = selectBrightness(getState());
    dispatch(
      setNovastarBrightness({
        path: address,
        screen: -1,
        percent: brightness,
      })
    );
  };

  const closeHandler = (address: string): void => {
    dispatch(removeNovastar(address));
    delete novastarControls[address];
  };
  net.on('open', openHandler);
  net.on('close', closeHandler);
  dispatch(findNetNovastarDevices());
  window.setInterval(() => {
    const ids = selectNovastarIds(getState() as RootState) as string[];
    ids.forEach(async path => {
      await dispatch(readLightSensor(path));
      await dispatch(updateHasDviIn(path));
    });
  }, MIN_INTERVAL * 1000);
};

startAppListening({
  actionCreator: setBrightness,
  effect: async ({ payload: percent }, { dispatch, getState }) => {
    const ids = selectNovastarIds(getState()) as string[];
    ids.forEach(path =>
      dispatch(
        setNovastarBrightness({
          path,
          screen: -1,
          percent,
        })
      )
    );
  },
});

export default novastarsSlice.reducer;
