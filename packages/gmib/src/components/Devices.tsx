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
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Tooltip from '@material-ui/core/Tooltip';
import LinkIcon from '@material-ui/icons/Link';
import UsbIcon from '@material-ui/icons/Usb';
import { DeviceId, getDefaultSession } from '@nibus/core';
import React, { useCallback, useMemo } from 'react';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import ReloadIcon from '@material-ui/icons/Refresh';
import { useSelector, useDispatch } from '../store';
import { selectAllDevicesWithParent } from '../store/devicesSlice';
import {
  selectCurrentDeviceId,
  activateDevice,
  selectCurrentTab,
  setCurrentTab,
  TabValues,
} from '../store/currentSlice';
import { getSessionId } from '../util/helpers';
import AccordionList from './AccordionList';
import DeviceIcon from './DeviceIcon';
import { reloadSession } from '../store/sessionsSlice';

const useStyles = makeStyles(theme => ({
  wrapper: {
    position: 'relative',
  },
  kind: {
    color: theme.palette.primary.light,
    position: 'absolute',
    bottom: 0,
    right: -16,
    fontSize: '1em',
  },
}));

const name = 'devices';

const Devices: React.FC = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const devices = useSelector(selectAllDevicesWithParent);
  const current = useSelector(selectCurrentDeviceId);
  const tab = useSelector(selectCurrentTab);
  // const [, setAccordion] = useAccordion();
  const reloadHandler = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    e => {
      dispatch(reloadSession(getSessionId(getDefaultSession())));
      e.stopPropagation();
    },
    [dispatch]
  );
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const id = e.currentTarget.dataset.id as DeviceId;
      dispatch(activateDevice(id));
    },
    [dispatch]
  );
  const title = useMemo(
    () => (
      <Box display="flex" alignItems="center" justifyContent="space-between" width={1}>
        <Typography>Устройства</Typography>
        <IconButton size="small" title="Повторить поиск" onClick={reloadHandler}>
          <ReloadIcon />
        </IconButton>
      </Box>
    ),
    [reloadHandler]
  );
  return (
    <AccordionList
      name={name}
      title={title}
      expanded={tab === 'devices' && devices.length > 0}
      onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
    >
      {devices.map(device => {
        const { id, connected, path, mib, isEmptyAddress, parent, address, category } = device;
        // Reflect.getMetadata('parent', device);
        // const mib = Reflect.getMetadata('mib', device);
        // const desc = device.connection?.description ?? {};
        // let Icon = DeviceIcon;
        // if (!parent && desc.link) {
        //   Icon = DeviceHubIcon;
        // } else if (mib && mib.startsWith('minihost')) {
        //   Icon = TvIcon;
        // }
        return (
          <ListItem
            button
            key={id}
            onClick={clickHandler}
            data-id={id}
            selected={id === current}
            disabled={!connected}
            id={`tab-${id}`}
            aria-controls={`tabpanel-${id}`}
          >
            <ListItemIcon>
              <div className={classes.wrapper}>
                <DeviceIcon color="inherit" device={device} />
                {parent ? (
                  <Tooltip title={parent.address}>
                    <LinkIcon className={classes.kind} />
                  </Tooltip>
                ) : (
                  path && (
                    <Tooltip title={path}>
                      <UsbIcon className={classes.kind} />
                    </Tooltip>
                  )
                )}
              </div>
            </ListItemIcon>
            <ListItemText
              primary={isEmptyAddress ? category : address}
              secondary={isEmptyAddress ? id : mib}
            />
          </ListItem>
        );
      })}
    </AccordionList>
  );
};

export default Devices;
