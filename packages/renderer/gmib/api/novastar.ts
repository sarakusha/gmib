import { createEntityAdapter } from '@reduxjs/toolkit';
import type { EntityState, Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';
import debugFactory from 'debug';

import type { Novastar, Screen, ScreenId } from '/@common/novastar';
import type { CabinetInfo } from '/@common/helpers';
import { NovastarSelector } from '/@common/helpers';
import { host, port } from '/@common/remote';

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

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:nova`);

let novastarEnabled = false;

export const hasNovastar = () => novastarEnabled;

window.initializeNovastar().then(value => {
  if (value !== novastarEnabled) {
    novastarEnabled = value;
  }
});

// window.config.get('announce').then(announce => {
//   console.log('ANNOUNCE', announce);
//   if (
//     announce &&
//     typeof announce === 'object' &&
//     import.meta.env.VITE_ANNOUNCE_NOVASTAR in announce
//   ) {
//     novastarEnabled = !!announce[import.meta.env.VITE_ANNOUNCE_NOVASTAR];
//   }
// });

// const secret = window.identify.getSecret();

const adapter = createEntityAdapter<Novastar>({
  selectId: ({ path }) => path,
  sortComparer: (a, b) => a.path.localeCompare(b.path),
});

export type ScreenParam<K extends keyof Screen = keyof Screen> = ScreenId & {
  name: K;
  value: Screen[K];
};

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
          const result = response.ok ? await response.json() : [];
          // if (response.status === 401) {
          //   result.host = response.headers.get('x-from');
          // }
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
    startTelemetry: build.mutation<void, { path: string; selectors?: NovastarSelector[] }>({
      query: ({
        path,
        selectors = [
          NovastarSelector.Temperature,
          NovastarSelector.Voltage,
          NovastarSelector.FPGA_Version,
          NovastarSelector.MCU_Version,
        ],
      }) => ({
        url: 'novastar/telemetry/start',
        method: 'POST',
        body: { path, selectors },
      }),
    }),
    cancelTelemetry: build.mutation<void, string>({
      query: path => ({
        url: 'novastar/telemetry/cancel',
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

export const useNovastarIds = () =>
  novastarApi.useGetNovastarsQuery(undefined, {
    skip: !novastarEnabled,
    selectFromResult: ({ data, ...other }) => ({
      ids: data && selectNovastarIds(data),
      ...other,
    }),
  });

export const useNovastars = () =>
  novastarApi.useGetNovastarsQuery(undefined, {
    skip: !novastarEnabled,
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
    skip: !path || !novastarEnabled,
  });

export const { useReloadMutation, useStartTelemetryMutation, useCancelTelemetryMutation } =
  novastarApi;

export const sse: Middleware = api => {
  const { getState, dispatch } = api as MiddlewareAPI<AppDispatch, RootState>;
  const socket = new WebSocket(`ws://${host}:${+port + 1}`);
  socket.onopen = () => socket.send(JSON.stringify({ sourceId: 0 }));
  const evtSource = new EventTarget();
  socket.onmessage = (e: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(e.data);
      if (
        typeof msg === 'object' &&
        'event' in msg &&
        typeof msg.event === 'string' &&
        'data' in msg &&
        Array.isArray(msg.data)
      ) {
        evtSource.dispatchEvent(new CustomEvent(msg.event, { detail: msg.data }));
      }
    } catch (err) {
      debug(`unknown event: ${e.data}`);
    }
  };
  const novastarReady = () =>
    new Promise<void>((resolve, reject) => {
      setTimeout(
        () =>
          dispatch(novastarApi.endpoints.getNovastars.initiate())
            .unwrap()
            .then(() => resolve(), reject),
        0,
      );
    });
  evtSource.addEventListener('add', async e => {
    try {
      const [device] = (e as CustomEvent<[Novastar]>).detail;
      await novastarReady();
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.addOne(draft, device);
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('change', async e => {
    try {
      const [id, changes] = (e as CustomEvent<[string, Partial<Novastar>]>).detail;
      await novastarReady();
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.updateOne(draft, { id, changes });
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('illuminance', e => {
    try {
      const [address, value] = (e as CustomEvent<[string, number]>).detail;
      dispatch(pushSensorValue({ kind: 'illuminance', address, value }));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('remove', async e => {
    try {
      const [path] = (e as CustomEvent<[string]>).detail;
      await novastarReady();
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
  evtSource.addEventListener('screen', async e => {
    try {
      const [screenId, key, value] = (e as CustomEvent<[ScreenId, keyof Screen, never]>).detail;
      await novastarReady();
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
  evtSource.addEventListener('update', async e => {
    try {
      const [device] = (e as CustomEvent<[Novastar]>).detail;
      await novastarReady();
      dispatch(
        novastarApi.util.updateQueryData('getNovastars', undefined, draft => {
          adapter.setOne(draft, device);
        }),
      );
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('telemetry', e => {
    try {
      const [path, action] = (e as CustomEvent<[string, 'started' | 'finished']>).detail;
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
  evtSource.addEventListener('cabinet', e => {
    try {
      const payload = (e as CustomEvent<[string, CabinetInfo]>).detail;
      dispatch(addCabinetInfo(payload));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  evtSource.addEventListener('broadcastDetected', e => {
    try {
      const [address] = (e as CustomEvent<[string]>).detail;
      dispatch(setBroadcastDetected(address));
    } catch (err) {
      console.error(`error while parse args: ${(err as Error).message}`);
    }
  });
  return next => action => next(action);
};

// // TODO: REMOTE
// export const startTelemetry = async (
//   path: string,
//   selectors: NovastarSelector[] = [
//     NovastarSelector.Temperature,
//     NovastarSelector.Voltage,
//     NovastarSelector.FPGA_Version,
//     NovastarSelector.MCU_Version,
//   ],
// ): Promise<boolean> => {
//   const res = await fetch('/api/novastar/telemetry/start', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       authorization: `Bearer ${secret}`,
//     },
//     cache: 'no-cache',
//     body: JSON.stringify({ path, selectors }),
//   });
//   return res.ok;
// };

// // TODO: REMOTE
// export const cancelTelemetry = async (path: string): Promise<boolean> => {
//   const res = await fetch('/api/novastar/telemetry/cancel', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       authorization: `Bearer ${secret}`,
//     },
//     cache: 'no-cache',
//     body: JSON.stringify({ path }),
//   });
//   return res.ok;
// };

export default novastarApi;
