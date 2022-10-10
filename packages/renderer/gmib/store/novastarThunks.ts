import { createAsyncThunk } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import debounce from 'lodash/debounce';

import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';

import { startAppListening } from './listenerMiddleware';
import type { ScreenId } from './novastarSlice';
import { setScreenColorBrightness } from './novastarSlice';
import { selectNovastarIds, selectNovastarScreen } from './selectors';
// import { MIN_INTERVAL } from './sensorsSlice';

import type { AppThunkConfig, RootState } from './index';

import screenApi from '../api/screens';

import { asyncSerial, reIPv4 } from '/@common/helpers';

// import { isRemoteSession } from '/@common/remote';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:novastar`);

const selectScreenId = ({ path, screen }: ScreenId): string => `${path}[${screen}]`;
export const updateColorBrightness = createDebouncedAsyncThunk<void, ScreenId, AppThunkConfig>(
  'novastar/updateColorBrightness',
  async (payload, { getState }) => {
    const { path, screen } = payload;
    const item = selectNovastarScreen(getState(), path, screen);
    const { rgbv } = item ?? {};
    if (!rgbv) return;
    await window.novastar.setRGBVBrightness({ path, value: rgbv, screen });
  },
  50,
  {
    maxWait: 300,
    selectId: selectScreenId,
  },
);
/* export const setNovastarBrightness = createDebouncedAsyncThunk<void, ScreenBrightness>(
  'novastar/setNovastarBrightness',
  (opts: ScreenBrightness): Promise<void> => window.novastar.setBrightness(opts),
  100,
  {
    maxWait: 500,
    leading: true,
    selectId: selectScreenId,
  },
); */

/*
export const novastarInitializer: AsyncInitializer = (dispatch, getState) => {
  if (isRemoteSession) return;
  window.novastar.findNetDevices();
  window.setInterval(() => {
    const ids = selectNovastarIds(getState() as RootState) as string[];
    ids.forEach(async path => {
      await window.novastar.readLightSensor(path);
      await window.novastar.updateHasDviIn(path);
    });
  }, MIN_INTERVAL * 1000);
};
*/

/* startAppListening({
  actionCreator: setBrightness,
  effect: async ({ payload: percent }, { dispatch, getState }) => {
    const ids = selectNovastarIds(getState()) as string[];
    ids.forEach(path =>
      dispatch(
        setNovastarBrightness({
          path,
          screen: -1,
          percent,
        }),
      ),
    );
  },
}); */

startAppListening({
  actionCreator: setScreenColorBrightness,
  effect({ payload }, { dispatch, getOriginalState }) {
    const { path, screen, color, value } = payload;
    const scr = selectNovastarScreen(getOriginalState(), path, screen);
    if (scr?.rgbv?.[color] !== value) dispatch(updateColorBrightness(payload));
  },
});

// if (!isRemoteSession) {
//   let timer = 0;
//   const state: Record<string, { hasSensor: boolean; iteration: number }> = {};
//   startAppListening({
//     actionCreator: addNovastar,
//     effect(_, { getState }) {
//       const update = () => {
//         // debug('update novastars');
//         const ids = selectNovastarIds(getState()) as string[];
//         Promise.all(
//           ids.map(async path => {
//             let { hasSensor, iteration } = state[path] ?? { hasSensor: false, iteration: 0 };
//             if (iteration === 0 || hasSensor) {
//               hasSensor = (await window.novastar.readLightSensor(path)) != null;
//             }
//             await window.novastar.updateHasDviIn(path);
//             iteration += 1;
//             state[path] = { hasSensor, iteration: iteration % 6 };
//           }),
//         ).finally(() => {
//           timer = ids.length > 0 ? window.setTimeout(update, MIN_INTERVAL * 1000) : 0;
//         });
//       };
//       timer || update();
//     },
//   });
// startAppListening({
//   actionCreator: removeNovastar,
//   effect(_, { getState }) {
//     const { length } = selectNovastarIds(getState());
//     if (length === 0 && timer !== 0) {
//       window.clearTimeout(timer);
//       timer = 0;
//     }
//   },
// });
// }

const selectAddresses = screenApi.endpoints.getAddresses.select();

const updateNovastarDevicesImpl = (state: RootState): Promise<void> => {
  debug('update net devices...');
  const { data: addresses = [] } = selectAddresses(state);
  const devices = selectNovastarIds(state) as string[];
  const newAddresses = addresses
    .filter(address => reIPv4.test(address))
    .filter(address => devices.every(path => !path.startsWith(address)));
  return asyncSerial(newAddresses, async address => {
    const [found] = await window.novastar.findNetDevices(address);
    if (found) window.novastar.open(found);
  });
};

export const debouncedUpdateNovastarDevices = debounce(updateNovastarDevicesImpl, 5000);

export const updateNovastarDevices = createAsyncThunk<Promise<void>, void, AppThunkConfig>(
  'nova/updateDevices',
  (_, { getState }) => updateNovastarDevicesImpl(getState()),
);

startAppListening({
  predicate: (_, currentState, previousState) => {
    const { data: current } = selectAddresses(currentState);
    const { data: previous } = selectAddresses(previousState);
    return Boolean(
      current &&
        current !== previous &&
        (!previous ||
          previous.length !== current.length ||
          current.some((value, index) => value !== previous[index])),
    );
  },
  effect(_, { getState }) {
    debouncedUpdateNovastarDevices(getState());
  },
});
