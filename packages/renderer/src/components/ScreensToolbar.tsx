import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SaveIcon from '@mui/icons-material/Save';
import LoadIcon from '@mui/icons-material/SystemUpdateAlt';
import { IconButton, Tooltip } from '@mui/material';
import React from 'react';

import { useSelector } from '../store';
import type { ConfigState } from '../store/configSlice';

import type { Writable } from '/@common/helpers';
import { noop } from '/@common/helpers';

import { selectConfig } from '../store/selectors';

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

const ScreensToolbar: React.FC<{ readonly?: boolean; toggle?: () => void }> = ({
  readonly = true,
  toggle = noop,
}) => {
  const config = useSelector(selectConfig);
  return (
    <>
      <Tooltip title="Загрузить конфигурацию из файла">
        <IconButton color="inherit" onClick={() => load()} size="large">
          <LoadIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Сохранить конфигурацию в файл">
        <IconButton color="inherit" onClick={() => save(config)} size="large">
          <SaveIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={readonly ? 'Разблокировать' : 'Заблокировать'}>
        <IconButton onClick={toggle} color="inherit" size="large">
          {readonly ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Tooltip>
    </>
  );
};

export default ScreensToolbar;
