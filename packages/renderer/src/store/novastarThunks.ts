import { setBrightness } from './configSlice';
import createDebouncedAsyncThunk from './createDebouncedAsyncThunk';
import { startAppListening } from './listenerMiddleware';
import type { ScreenBrightness, ScreenId } from './novastarsSlice';
import { addNovastar, setScreenColorBrightness } from './novastarsSlice';
import { selectBrightness, selectNovastarIds, selectNovastarScreen } from './selectors';

const selectScreenId = ({ path, screen }: ScreenId): string => `${path}[${screen}]`;
export const updateColorBrightness = createDebouncedAsyncThunk<void, ScreenId>(
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
