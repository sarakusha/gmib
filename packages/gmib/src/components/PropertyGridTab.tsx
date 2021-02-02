/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import groupBy from 'lodash/groupBy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReloadIcon from '@material-ui/icons/Refresh';
import SaveIcon from '@material-ui/icons/Save';
import LoadIcon from '@material-ui/icons/OpenInBrowser';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import { useSelector, useDispatch, useDevice } from '../store';
import type { AppDispatch } from '../store';
import { selectCurrentDeviceId } from '../store/currentSlice';
import { selectMibByName } from '../store/mibsSlice';
import TableCell from './TableCell';
import AccordionList, { AccordionProvider } from './AccordionList';
import ErrorCard from './ErrorCard';
import PropertyValueCell from './PropertyValueCell';
import SaveDialog from '../dialogs/SaveDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import type { Props } from './TabContainer';
import {
  DeviceId,
  PropTuple,
  reloadDevice,
  setDeviceValue,
  ValueType,
} from '../store/devicesSlice';

const useStyles = makeStyles(theme => ({
  error: {
    display: 'flex',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  name: {
    paddingLeft: theme.spacing(3),
  },
  table: {
    '& table': {
      borderCollapse: 'separate',
    },
  },
}));

const useSummaryClasses = makeStyles(theme => ({
  expanded: {
    backgroundColor: theme.palette.action.selected,
  },
  root: {
    '& > *': {
      backgroundColor: 'transparent',
    },
  },
}));

const load = (dispatch: AppDispatch, id: DeviceId, mib: string): boolean => {
  const fileNames: string[] | undefined = ipcRenderer.sendSync('showOpenDialogSync', {
    title: 'Загрузить из',
    filters: [
      {
        name: 'JSON',
        extensions: ['json'],
      },
    ],
    properties: ['openFile'],
  } as Electron.OpenDialogSyncOptions);
  if (fileNames?.[0]) {
    try {
      const data = JSON.parse(fs.readFileSync(fileNames[0]).toString());
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

const PropertyGridTab: React.FC<Props> = ({ id, selected = false }) => {
  const classes = useStyles();
  const current = useSelector(selectCurrentDeviceId); // useDevicesContext();
  const device = useDevice(id);
  const { mib, isBusy } = device ?? {};
  const meta = useSelector(state => selectMibByName(state, mib ?? 0));
  const dispatch = useDispatch();
  const setValue = useMemo(() => {
    const action = setDeviceValue(id);
    return (name: string, value: ValueType) => {
      dispatch(action(name, value));
    };
  }, [id, dispatch]);
  const [saveIsOpen, setSaveOpen] = useState(false);
  const closeSaveDialog = useCallback(() => setSaveOpen(false), []);
  const saveHandler = useCallback(() => setSaveOpen(true), []);
  const reloadHandler = useCallback(async () => {
    dispatch(reloadDevice(id));
  }, [dispatch, id]);
  const reloadToolbar = useMemo(
    () => (
      <>
        <Tooltip title="Загрузить свойства из файла" enterDelay={1000}>
          <IconButton
            color="inherit"
            onClick={() => mib && load(dispatch, id, mib)}
            disabled={!mib}
          >
            <LoadIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Сохранить выбранные свойства в файл" enterDelay={1000}>
          <IconButton color="inherit" onClick={saveHandler} disabled={!mib}>
            <SaveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Обновить свойства" enterDelay={1000}>
          <div className={classes.toolbarWrapper}>
            <IconButton color="inherit" onClick={reloadHandler} disabled={!!isBusy}>
              <ReloadIcon />
            </IconButton>
            {isBusy && <CircularProgress size={48} className={classes.fabProgress} />}
          </div>
        </Tooltip>
      </>
    ),
    [
      dispatch,
      id,
      mib,
      reloadHandler,
      isBusy,
      classes.fabProgress,
      classes.toolbarWrapper,
      saveHandler,
    ]
  );

  const [, setToolbar] = useToolbar();

  useEffect(
    () =>
      setToolbar((toolbar: React.ReactNode) => {
        if (selected && current === id) return reloadToolbar;
        return toolbar === reloadToolbar ? null : toolbar;
      }),
    [selected, current, id, reloadToolbar, setToolbar]
  );

  const categories = useMemo(
    () => (meta ? groupBy(Object.entries(meta.properties), ([, { category }]) => category) : null),
    [meta]
  );

  const summaryClasses = useSummaryClasses();
  if (!device || !meta || !categories) return null;
  const { props, error } = device;

  if (error) {
    return (
      <div className={classes.error}>
        <ErrorCard error={error} onAction={() => dispatch(reloadDevice(id))} />
      </div>
    );
  }

  return (
    <Box px={1} width={1} fontSize="body1.fontSize" display={selected ? 'block' : 'none'}>
      <AccordionProvider>
        {Object.entries(categories).map(([category, propNames]) => (
          <AccordionList
            key={category}
            name={category || 'other'}
            title={category}
            component={Table}
            summaryClasses={summaryClasses}
            className={classes.table}
          >
            <TableBody>
              {propNames.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell className={classes.name}>
                    {`${info.displayName}${info.unit ? ` в ${info.unit}` : ''}`}
                  </TableCell>
                  <PropertyValueCell
                    meta={info}
                    name={name}
                    state={props[name]}
                    onChangeProperty={setValue}
                  />
                </TableRow>
              ))}
            </TableBody>
          </AccordionList>
        ))}
      </AccordionProvider>
      <SaveDialog open={saveIsOpen} close={closeSaveDialog} device={device} />
    </Box>
  );
};

export default React.memo(PropertyGridTab);
