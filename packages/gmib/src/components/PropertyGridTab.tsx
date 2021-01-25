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
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import { IDevice } from '@nibus/core';
import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReloadIcon from '@material-ui/icons/Refresh';
import SaveIcon from '@material-ui/icons/Save';
import LoadIcon from '@material-ui/icons/OpenInBrowser';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import TableCell from './TableCell';
import { useDevicesContext } from '../providers/DevicesProvier';
import AccordionList, { AccordionProvider } from './AccordionList';

import ErrorCard from './ErrorCard';
import PropertyValueCell from './PropertyValueCell';
import { useDevice } from '../providers/DevicesStateProvider';
import SaveDialog from '../dialogs/SaveDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import type { Props } from './TabContainer';

// const { dialog } = remote;
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

const load = async (device: IDevice): Promise<boolean> => {
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
      const mib = Reflect.getMetadata('mib', device);
      if (data.$mib !== mib) {
        ipcRenderer.sendSync('showErrorBox', 'Ошибка загрузки', 'Тип устройства не совпадает');
        return false;
      }
      delete data.$mib;
      Object.assign(device, data);
      await device.drain();
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
  const { current } = useDevicesContext();
  const { props, setValue, error, reload, proto, isDirty, device, names } = useDevice(id);
  // useEffect(() => console.log('CHANGED'), [names]);
  const [busy, setBusy] = useState(false);
  const [saveIsOpen, setSaveOpen] = useState(false);
  const closeSaveDialog = useCallback(() => setSaveOpen(false), []);
  const saveHandler = useCallback(() => setSaveOpen(true), []);
  const reloadHandler = useCallback(async () => {
    setBusy(true);
    await reload();
    setBusy(false);
  }, [reload]);
  const loadHandler = useCallback(async () => {
    if (await load(device!)) {
      await reload();
    }
  }, [device, reload]);
  const reloadToolbar = useMemo(
    () => (
      <>
        <Tooltip title="Загрузить свойства из файла" enterDelay={1000}>
          <IconButton color="inherit" onClick={loadHandler} disabled={!device}>
            <LoadIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Сохранить выбранные свойства в файл" enterDelay={1000}>
          <IconButton color="inherit" onClick={saveHandler} disabled={!device}>
            <SaveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Обновить свойства" enterDelay={1000}>
          <div className={classes.toolbarWrapper}>
            <IconButton color="inherit" onClick={reloadHandler} disabled={busy}>
              <ReloadIcon />
            </IconButton>
            {busy && <CircularProgress size={48} className={classes.fabProgress} />}
          </div>
        </Tooltip>
      </>
    ),
    [
      loadHandler,
      device,
      reloadHandler,
      busy,
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

  const release = useMemo(
    () => (device && Reflect.getMetadata('parent', device) ? () => device.release() : undefined),
    [device]
  );

  const categories = useMemo(() => {
    if (!proto) return null;
    const formatDisplayName = (name: string): string => {
      const displayName = Reflect.getMetadata('displayName', proto, name);
      const unit = Reflect.getMetadata('unit', proto, name);
      return `${displayName}${unit ? ` в ${unit}` : ''}`;
    };
    return groupBy(
      names.map(name => [name, formatDisplayName(name)]),
      ([name]) => (proto && (Reflect.getMetadata('category', proto, name) as string)) ?? ''
    );
  }, [names, proto]);

  const summaryClasses = useSummaryClasses();

  if (error) {
    return (
      <div className={classes.error}>
        <ErrorCard error={error} onAction={reload} onRelease={release} />
      </div>
    );
  }

  if (isEmpty(props) || !proto || !categories) return null;

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
              {propNames.map(([name, displayName]) => (
                <TableRow key={name}>
                  <TableCell className={classes.name}>{displayName}</TableCell>
                  <PropertyValueCell
                    proto={proto}
                    name={name}
                    value={props[name]}
                    dirty={isDirty(name)}
                    onChangeProperty={setValue}
                  />
                </TableRow>
              ))}
            </TableBody>
          </AccordionList>
        ))}
      </AccordionProvider>
      <SaveDialog open={saveIsOpen} close={closeSaveDialog} device={device!} />
    </Box>
  );
};

// export default compose<Props, Props>(hot, React.memo)(PropertyGrid);
export default PropertyGridTab;
