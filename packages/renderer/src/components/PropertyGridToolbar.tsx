import ReloadIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import LoadIcon from '@mui/icons-material/SystemUpdateAlt';
import { IconButton, Tooltip } from '@mui/material';
import type { DeviceId } from '@nibus/core';
import React, { useCallback, useState } from 'react';

import SaveDialog from '../dialogs/SaveDialog';
import type { AppDispatch } from '../store';
import { useDispatch, useSelector } from '../store';
import { reloadDevice } from '../store/deviceThunks';
import type { PropTuple } from '../store/devicesSlice';
import { selectCurrentDevice } from '../store/selectors';

import BusyButton from './BusyButton';

const load = (dispatch: AppDispatch, id: DeviceId, mib: string): boolean => {
  const data = window.dialogs.loadJSON('Загрузить из');
  if (data) {
    if (data.$mib !== mib) {
      window.dialogs.showErrorBox('Ошибка загрузки', 'Тип устройства не совпадает');
      return false;
    }
    delete data.$mib;
    const setValue = window.nibus.setDeviceValue(id);
    Object.entries(data).forEach(prop => setValue(...(prop as PropTuple)));
    return true;
  }
  return false;
};

const PropertyGridToolbar: React.FC = () => {
  const device = useSelector(selectCurrentDevice);
  const { id, mib, isBusy = 0 } = device ?? {};
  const dispatch = useDispatch();
  const [saveIsOpen, setSaveOpen] = useState(false);
  const closeSaveDialog = useCallback(() => setSaveOpen(false), []);
  const saveHandler = useCallback(() => setSaveOpen(true), []);
  const reloadHandler = (): void => {
    id && dispatch(reloadDevice(id));
  };
  return (
    <>
      <Tooltip title="Загрузить свойства из файла" enterDelay={1000}>
        <div>
          <IconButton
            color="inherit"
            onClick={() => id && mib && load(dispatch, id, mib)}
            disabled={!mib}
            size="large"
          >
            <LoadIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Сохранить выбранные свойства в файл" enterDelay={1000}>
        <div>
          <IconButton color="inherit" onClick={saveHandler} disabled={!mib} size="large">
            <SaveIcon />
          </IconButton>
        </div>
      </Tooltip>
      <BusyButton
        icon={<ReloadIcon />}
        title="Обновить свойства"
        isBusy={isBusy > 0}
        onClick={reloadHandler}
      />
      <SaveDialog open={saveIsOpen} close={closeSaveDialog} deviceId={id} />
    </>
  );
};

export default React.memo(PropertyGridToolbar);
