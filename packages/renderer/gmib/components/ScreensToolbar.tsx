import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import VolumeIcon from '@mui/icons-material/AllOut';
// import LockIcon from '@mui/icons-material/Lock';
// import LockOpenIcon from '@mui/icons-material/LockOpen';
import Refresh from '@mui/icons-material/Refresh';
import { IconButton } from '@mui/material';
import React from 'react';

import { updateScreen, useReloadScreenMutation, useScreen } from '../api/screens';
import { useDispatch, useSelector } from '../store';
import { selectBrightness, selectCurrentScreenId, selectHID } from '../store/selectors';

import Brightness from './HBrightness';

/*
const load = (): void => {
  const data = window.dialogs.loadJSON('Загрузить из');
  if (data) {
    window.nibus.sendConfig(data);
  }
};

const save = (config: ConfigState): void => {
  const defaultPath = `${import.meta.env.VITE_APP_NAME}.${config.screens
    .map(scr => `${scr.width}x${scr.height}`)
    .join('.')}`;
  const clone: Partial<Writable<ConfigState>> = JSON.parse(JSON.stringify(config));
  clone.pages = clone.pages?.filter(({ permanent }) => !permanent);
  delete clone.brightness;
  delete clone.loading;
  window.dialogs.saveJSON({ defaultPath, data: clone });
};
*/

const ScreensToolbar: React.FC = () => {
  const brightness = useSelector(selectBrightness);
  const hid = useSelector(selectHID);
  const dispatch = useDispatch();
  const screenId = useSelector(selectCurrentScreenId);
  const { screen } = useScreen(screenId);
  const handleBrightness = React.useCallback(
    (e: unknown, value: number | number[]) =>
      !Array.isArray(value) &&
      screenId &&
      dispatch(updateScreen(screenId, prev => ({ ...prev, brightness: value }))),
    [dispatch, screenId],
  );
  const [reload] = useReloadScreenMutation();
  const isAuto = screen && screen.brightnessFactor !== 0;
  const isValidHid = Boolean(hid?.VID && hid.PID);
  const useKnob = screen && !isAuto && isValidHid && screen.useExternalKnob;
  const disabled = !screen || isAuto || useKnob;
  let currentBrightness = 0;
  if (screen) {
    if (screen.brightnessFactor)
      currentBrightness = Math.min(brightness * screen.brightnessFactor, 100);
    else if (!useKnob) currentBrightness = screen.brightness ?? 0;
    else currentBrightness = hid?.brightness ?? hid?.minBrightness ?? 0;
  }
  return (
    <>
      <IconButton
        title="Обновить"
        size="large"
        disabled={!screen?.test}
        color="inherit"
        onClick={() => screenId && reload(screenId)}
      >
        <Refresh />
      </IconButton>
      <IconButton
        color={disabled ? 'inherit' : 'default'}
        onClick={() =>
          screenId &&
          dispatch(
            updateScreen(screenId, prev => ({
              ...prev,
              brightnessFactor: prev.brightnessFactor ? 0 : 1,
            })),
          )
        }
        title="Автояркость"
        size="large"
        disabled={useKnob}
      >
        {useKnob ? <VolumeIcon /> : <BrightnessAutoIcon />}
      </IconButton>
      <Brightness value={currentBrightness} onChange={handleBrightness} disabled={disabled} />
      {/*       <Tooltip title={readonly ? 'Разблокировать' : 'Заблокировать'}>
        <IconButton onClick={toggle} color="inherit" size="large" disabled={invalidState}>
          {readonly ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Tooltip> */}
    </>
  );
};
export default ScreensToolbar;
