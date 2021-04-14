/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { CircularProgress, IconButton, Tooltip } from '@material-ui/core';
// import LoadIcon from '@material-ui/icons/OpenInBrowser';
import ReloadIcon from '@material-ui/icons/Refresh';
import LoadIcon from '@material-ui/icons/SystemUpdateAlt';
import SaveIcon from '@material-ui/icons/Save';
import { DeviceId } from '@nibus/core';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import React, { useCallback, useState } from 'react';
import SaveDialog from '../dialogs/SaveDialog';
import { AppDispatch, useDispatch, useSelector } from '../store';
import {
  PropTuple,
  reloadDevice,
  selectCurrentDevice,
  setDeviceValue,
} from '../store/devicesSlice';

const useStyles = makeStyles(theme => ({
  toolbarWrapper: {
    position: 'relative',
  },
  fabProgress: {
    color: theme.palette.secondary.light,
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    zIndex: 1,
  },
}));

const load = (dispatch: AppDispatch, id: DeviceId, mib: string): boolean => {
  const [fileName]: string[] =
    ipcRenderer.sendSync('showOpenDialogSync', {
      title: 'Загрузить из',
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
      properties: ['openFile'],
    } as Electron.OpenDialogSyncOptions) ?? [];
  if (fileName) {
    try {
      const data = JSON.parse(fs.readFileSync(fileName).toString());
      if (data.$mib !== mib) {
        ipcRenderer.sendSync('showErrorBox', 'Ошибка загрузки', 'Тип устройства не совпадает');
        return false;
      }
      delete data.$mib;
      const setValue = setDeviceValue(id);
      Object.entries(data).forEach(prop => dispatch(setValue(...(prop as PropTuple))));
      return true;
    } catch (e) {
      ipcRenderer.sendSync('showErrorBox', 'Ошибка загрузки', 'Файл испорчен');
      return false;
    }
  }
  return false;
};

const PropertyGridToolbar: React.FC = () => {
  const device = useSelector(selectCurrentDevice);
  const { id, mib, isBusy = 0 } = device ?? {};
  const dispatch = useDispatch();
  const classes = useStyles();
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
          >
            <LoadIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Сохранить выбранные свойства в файл" enterDelay={1000}>
        <div>
          <IconButton color="inherit" onClick={saveHandler} disabled={!mib}>
            <SaveIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Обновить свойства" enterDelay={1000}>
        <div className={classes.toolbarWrapper}>
          <IconButton color="inherit" onClick={reloadHandler} disabled={isBusy > 0}>
            <ReloadIcon />
          </IconButton>
          {isBusy > 0 && <CircularProgress size={48} className={classes.fabProgress} />}
        </div>
      </Tooltip>
      <SaveDialog open={saveIsOpen} close={closeSaveDialog} deviceId={id} />
    </>
  );
};

export default React.memo(PropertyGridToolbar);
