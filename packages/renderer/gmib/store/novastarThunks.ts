import debugFactory from 'debug';

import { setBrightness } from './configSlice';
import { startAppListening } from './listenerMiddleware';
import type { ScreenBrightness, ScreenId } from './novastarsSlice';
import { addNovastar, removeNovastar, setScreenColorBrightness } from './novastarsSlice';
import { selectBrightness, selectNovastarIds, selectNovastarScreen } from './selectors';
import { MIN_INTERVAL } from './sensorsSlice';

import type { AppThunkConfig } from './index';

import { isRemoteSession } from '/@common/remote';
import createDebouncedAsyncThunk from '/@common/createDebouncedAsyncThunk';

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
export const setNovastarBrightness = createDebouncedAsyncThunk<void, ScreenBrightness>(
  'novastar/setNovastarBrightness',
  (opts: ScreenBrightness): Promise<void> => window.novastar.setBrightness(opts),
  100,
  {
    maxWait: 500,
    leading: true,
    selectId: selectScreenId,
  },
);

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
        }),
      ),
    );
  },
});

startAppListening({
  actionCreator: addNovastar,
  effect: async ({ payload: { path } }, { dispatch, getState }) => {
    await window.novastar.reloadNovastar(path);
    const brightness = selectBrightness(getState());
    dispatch(
      setNovastarBrightness({
        path,
        screen: -1,
        percent: brightness,
      }),
    );
  },
});

startAppListening({
  actionCreator: setScreenColorBrightness,
  effect({ payload }, { dispatch, getOriginalState }) {
    const { path, screen, color, value } = payload;
    const scr = selectNovastarScreen(getOriginalState(), path, screen);
    if (scr?.rgbv?.[color] !== value) dispatch(updateColorBrightness(payload));
  },
});

if (!isRemoteSession) {
  let timer = 0;
  const state: Record<string, { hasSensor: boolean; iteration: number }> = {};
  startAppListening({
    actionCreator: addNovastar,
    effect(_, { getState }) {
      const update = () => {
        // debug('update novastars');
        const ids = selectNovastarIds(getState()) as string[];
        Promise.all(
          ids.map(async path => {
            let { hasSensor, iteration } = state[path] ?? { hasSensor: false, iteration: 0 };
            if (iteration === 0 || hasSensor) {
              hasSensor = (await window.novastar.readLightSensor(path)) != null;
            }
            await window.novastar.updateHasDviIn(path);
            iteration += 1;
            state[path] = { hasSensor, iteration: iteration % 6 };
          }),
        ).finally(() => {
          timer = ids.length > 0 ? window.setTimeout(update, MIN_INTERVAL * 1000) : 0;
        });
      };
      update();
    },
  });
  startAppListening({
    actionCreator: removeNovastar,
    effect(_, { getState }) {
      const { length } = selectNovastarIds(getState());
      if (length === 0 && timer !== 0) {
        window.clearTimeout(timer);
        timer = 0;
      }
    },
  });
}
