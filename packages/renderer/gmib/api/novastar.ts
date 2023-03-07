import { createEntityAdapter } from '@reduxjs/toolkit';
import type { EntityState, Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

// import debugFactory from 'debug';
import type { Novastar, Screen, ScreenId } from '/@common/novastar';
import type { CabinetInfo } from '/@common/helpers';
import { NovastarSelector } from '/@common/helpers';

import type { SetStateAction } from 'react';

import baseQuery from '../../common/authBaseQuery';
import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import type { AppDispatch, AppThunk, AppThunkConfig, RootState } from '../store';
import { setBroadcastDetected, setCurrentDevice } from '../store/currentSlice';
import { selectCurrentDeviceId } from '../store/selectors';
import { pushSensorValue } from '../store/sensorsSlice';
import {
  addCabinetInfo,
  finishNovastarTelemetry,
  startNovastarTelemetry,
} from '../store/telemetrySlice';

const secret = window.identify.getSecret();

const adapter = createEntityAdapter<Novastar>({
  selectId: ({ path }) => path,
  sortComparer: (a, b) => a.path.localeCompare(b.path),
});

export type ScreenParam<K extends keyof Screen = keyof Screen> = ScreenId & {
  name: K;
  value: Screen[K];
};

// type ScreenColorBrightness = ScreenId & {
//   color: keyof BrightnessRGBV;
//   value: number;
// };

export type ScreenBrightness = ScreenId & {
  value: number;
};

export const {
  selectAll: selectNovastars,
  selectById: selectNovastar,
  selectIds: selectNovastarIds,
} = adapter.getSelectors();

export const selectSerials = (state: EntityState<Novastar>): Novastar[] =>
  selectNovastars(state).filter(item => item.isSerial);

const novastarApi = createApi({
  baseQuery,
  reducerPath: 'novastarApi',
  endpoints: build => ({
    getNovastars: build.query<EntityState<Novastar>, void>({
      query: () => ({
        url: 'novastar',
        responseHandler: async response => {
          const result = await response.json();
          if (response.status === 401) {
            result.host = response.headers.get('x-from');
          }
          return result;
        },
      }),
      transformResponse: (response: Novastar[]) =>
        adapter.addMany(adapter.getInitialState(), response),
    }),
    reload: build.mutation<Novastar, string>({
      query: path => ({
        url: 'novastar/reload',
        method: 'POST',
        body: { path },
      }),
    }),
    updateScreens: build.mutation<void, ScreenParam>({
      query: ({ name, ...other }) => ({
        url: `novastar/screens/${name}`,
        method: 'PUT',
        body: other,
      }),
    }),
    // setDisplayMode: build.mutation<void, ScreenArg<'mode'>>({
    //   query: ({ value, screen, path }) => ({
    //     url: 'novastar/mode',
    //     method: 'PUT',
    //     body: JSON.stringify(value),
    //   }),
    // }),
    // setGamma: build.mutation<void, ScreenArg<'gamma'>>({
    //   query: ({ value, screen, path }) => ({
    //     url: `novastar/${path}/gamma`,
    //     method: 'PUT',
    //     params: { screen },
    //     body: JSON.stringify(value),
    //   }),
    // }),
    // setRGBVBrightness: build.mutation<void, ScreenArg<'rgbv'>>({
    //   query: ({ value, screen, path }) => ({
    //     url: `novastar/${path}/rgbv`,
    //     method: 'PUT',
    //     params: { screen },
    //     body: JSON.stringify(value),
    //   }),
    // }),
    setBrightness: build.mutation<void, ScreenBrightness>({
      query: arg => ({
        url: 'novastar/screens/brightness',
        method: 'PUT',
        body: arg,
      }),
    }),
  }),
});

const debouncedUpdateNovastarScreens = createDebouncedAsyncThunk<void, ScreenParam, AppThunkConfig>(
  'novastarApi/updateScreens',
  (update, { dispatch }) => {
    dispatch(novastarApi.endpoints.updateScreens.initiate(update));
  },
  200,
  { selectId: ({ path, screen, name }) => `${path}[${screen}].${name}` },
);

const updateValue =
  <K extends keyof Screen>(name: K, update: SetStateAction<Screen[K]>) =>
  (prev: Screen): Screen => ({
    ...prev,
    [name]: typeof update !== 'function' ? update : update(prev[name]),
  });

export const updateNovastarScreens = <K extends keyof Screen, S extends number>(
  path: string,
  screen: S,
  name: K,
  update: S extends -1 ? Screen[K] : SetStateAction<Screen[K]>,
): AppThunk => {
  if (screen === -1 && typeof update === 'function')
    throw new Error('Only use the function for a specific screen.');
  return dispatch => {
    const updateScreen = updateValue(name, update);
    dispatch(
      novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
        const prev = selectNovastar(draft, path);
        if (!prev) throw new Error(`Unknown novastar: ${path}`);
        if (!prev.screens) return;
        const screens = prev.screens.map<Screen>((scr, index) =>
          screen === -1 || index === screen ? updateScreen(scr) : scr,
        );
        adapter.updateOne(draft, { id: path, changes: { screens } });
        dispatch(
          debouncedUpdateNovastarScreens({
            path,
            screen,
            name,
            value: screens[screen !== -1 ? screen : 0]?.[name],
          }),
        );
      }),
    );
  };
};

// export const setScreenColorBrightness = createAsyncThunk<
//   void,
//   ScreenColorBrightness,
//   AppThunkConfig
// >('novastarApi/colorBrightness', ({ path, screen, color, value }, { getState, dispatch }) => {
//   const novastarData = selectNovastarData(getState()).data;
//   if (novastarData) {
//     const rgbv = selectNovastar(novastarData, path)?.screens?.[screen]?.rgbv;
//     if (rgbv) {
//       dispatch(
//         novastarApi.endpoints.setRGBVBrightness.initiate({
//           path,
//           screen,
//           value: { ...rgbv, [color]: minmax(255, value) },
//         }),
//       );
//     }
//   }
// });

export const useNovastarIds = () =>
  novastarApi.useGetNovastarsQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      ids: data && selectNovastarIds(data),
      ...other,
    }),
  });

export const useNovastars = () =>
  novastarApi.useGetNovastarsQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      novastars: data && selectNovastars(data),
      ...other,
    }),
  });

export const useNovastar = (path?: string) =>
  novastarApi.useGetNovastarsQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      novastar: data && path ? selectNovastar(data, path) : undefined,
      ...other,
    }),
    skip: !path,
  });

export const { useReloadMutation } = novastarApi;

export const sse: Middleware = api => {
  const { getState, dispatch } = api as MiddlewareAPI<AppDispatch, RootState>;
  const evtSource = new EventSource('/api/novastar/subscribe');
  const novastarReady = new Promise<void>((resolve, reject) => {
    setTimeout(
      () =>
        dispatch(novastarApi.endpoints.getNovastars.initiate())
          .unwrap()
          .then(() => resolve(), reject),
      0,
    );
  });
  evtSource.addEventListener('add', async ({ data }) => {
    try {
      const [device] = JSON.parse(data) as [Novastar];
      await novastarReady;
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.addOne(draft, device);
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('change', async ({ data }) => {
    try {
      const [id, changes] = JSON.parse(data) as [string, Partial<Novastar>];
      await novastarReady;
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.updateOne(draft, { id, changes });
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('illuminance', ({ data }) => {
    try {
      const [address, value] = JSON.parse(data) as [string, number];
      dispatch(pushSensorValue({ kind: 'illuminance', address, value }));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('remove', async ({ data }) => {
    try {
      const [path] = JSON.parse(data) as [string];
      await novastarReady;
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.removeOne(draft, path);
        }),
      );
      if (selectCurrentDeviceId(getState()) === path) {
        dispatch(setCurrentDevice(undefined));
      }
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('screen', async ({ data }) => {
    try {
      const [screenId, key, value] = JSON.parse(data) as [ScreenId, keyof Screen, never];
      await novastarReady;
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          // const device = selectNovastar(draft, screenId.path);
          const screen = draft.entities[screenId.path]?.screens?.[screenId.screen];
          if (screen) {
            screen[key] = value;
          }
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('update', async ({ data }) => {
    try {
      const [device] = JSON.parse(data) as [Novastar];
      await novastarReady;
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.setOne(draft, device);
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('telemetry', ({ data }) => {
    try {
      const [path, action] = JSON.parse(data) as [string, 'started' | 'finished'];
      switch (action) {
        case 'started':
          dispatch(startNovastarTelemetry(path));
          break;
        case 'finished':
          dispatch(finishNovastarTelemetry(path));
          break;
        default:
      }
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('cabinet', ({ data }) => {
    try {
      const payload = JSON.parse(data) as [string, CabinetInfo];
      dispatch(addCabinetInfo(payload));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('broadcastDetected', ({ data }) => {
    try {
      const [address] = JSON.parse(data) as [string];
      dispatch(setBroadcastDetected(address));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  return next => action => next(action);
};

export const startTelemetry = async (
  path: string,
  selectors: NovastarSelector[] = [
    NovastarSelector.Temperature,
    NovastarSelector.Voltage,
    NovastarSelector.FPGA_Version,
    NovastarSelector.MCU_Version,
  ],
): Promise<boolean> => {
  const res = await fetch('/api/novastar/telemetry/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    cache: 'no-cache',
    body: JSON.stringify({ path, selectors }),
  });
  return res.ok;
};

export const cancelTelemetry = async (path: string): Promise<boolean> => {
  const res = await fetch('/api/novastar/telemetry/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    cache: 'no-cache',
    body: JSON.stringify({ path }),
  });
  return res.ok;
};

export default novastarApi;
