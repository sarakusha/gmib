import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Refresh from '@mui/icons-material/Refresh';
import { IconButton, Tooltip } from '@mui/material';
import React from 'react';

import { noop } from '/@common/helpers';

import { updateScreen, useReloadScreenMutation, useScreen } from '../api/screens';
import { useDispatch, useSelector } from '../store';
import { selectBrightness, selectCurrentScreenId, selectInvalidState } from '../store/selectors';

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

const ScreensToolbar: React.FC<{ readonly?: boolean; toggle?: () => void }> = ({
  readonly = true,
  toggle = noop,
}) => {
  const brightness = useSelector(selectBrightness);
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
  const invalidState = useSelector(selectInvalidState);
  const [reload] = useReloadScreenMutation();
  const disabled = !screen || screen.brightnessFactor !== 0;
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
      >
        <BrightnessAutoIcon />
      </IconButton>
      <Brightness
        value={disabled ? brightness * (screen?.brightnessFactor ?? 1) : screen.brightness}
        onChange={handleBrightness}
        disabled={disabled}
      />
{/*       <Tooltip title={readonly ? 'Разблокировать' : 'Заблокировать'}>
        <IconButton onClick={toggle} color="inherit" size="large" disabled={invalidState}>
          {readonly ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Tooltip> */}
    </>
  );
};
export default ScreensToolbar;
