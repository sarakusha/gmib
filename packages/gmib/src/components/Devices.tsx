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
import { makeStyles } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import LinkIcon from '@material-ui/icons/Link';
import UsbIcon from '@material-ui/icons/Usb';
import { DeviceId } from '@nibus/core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import ReloadIcon from '@material-ui/icons/Refresh';

import { useDevicesContext } from '../providers/DevicesProvier';
import { useSession } from '../providers/SessionProvider';
import useCurrent from '../providers/useCurrent';
import AccordionList, { useAccordion } from './AccordionList';
import DeviceIcon from './DeviceIcon';

const useStyles = makeStyles(theme => ({
  wrapper: {
    position: 'relative',
  },
  kind: {
    color: theme.palette.primary.light,
    position: 'absolute',
    // pointerEvents: 'none',
    bottom: 0,
    right: -16,
    fontSize: '1em',
  },
}));

const name = 'devices';

const Devices: React.FC = () => {
  const classes = useStyles();
  const { devices, current } = useDevicesContext();
  const setCurrent = useCurrent('device');
  const session = useSession();
  useEffect(() => {
    session.setLogLevel('hex');
  }, [session]);
  const devs = session.devices;
  const [, setAccordion] = useAccordion();
  const [, setUpdate] = useState(false);
  const reloadHandler = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    e => {
      session.reloadDevices();
      e.stopPropagation();
    },
    [session]
  );

  useEffect(() => {
    const sernoListener = (): void => setUpdate(prev => !prev);
    devs.on('serno', sernoListener);
    return () => {
      devs.off('serno', sernoListener);
    };
  }, [devs]);
  useEffect(() => setAccordion(name), [devices, setAccordion]);
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const id = (e.currentTarget.dataset.id as DeviceId) || null;
      setCurrent(id);
    },
    [setCurrent]
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
    <AccordionList name={name} title={title}>
      {devices.map(device => {
        const parent = Reflect.getMetadata('parent', device);
        // const mib = Reflect.getMetadata('mib', device);
        const desc = device.connection?.description ?? {};
        // let Icon = DeviceIcon;
        // if (!parent && desc.link) {
        //   Icon = DeviceHubIcon;
        // } else if (mib && mib.startsWith('minihost')) {
        //   Icon = TvIcon;
        // }
        return (
          <ListItem
            button
            key={device.id}
            onClick={clickHandler}
            data-id={device.id}
            selected={device.id === current}
            disabled={!device.connection}
          >
            <ListItemIcon>
              <div className={classes.wrapper}>
                <DeviceIcon color="inherit" device={device} />
                {parent ? (
                  <Tooltip title={parent.address.toString()}>
                    <LinkIcon className={classes.kind} />
                  </Tooltip>
                ) : (
                  device.connection && (
                    <Tooltip title={device.connection.path}>
                      <UsbIcon className={classes.kind} />
                    </Tooltip>
                  )
                )}
              </div>
            </ListItemIcon>
            <ListItemText
              primary={device.address.isEmpty ? desc.category : device.address.toString()}
              secondary={device.address.isEmpty ? device.id : Reflect.getMetadata('mib', device)}
            />
          </ListItem>
        );
      })}
    </AccordionList>
  );
};

export default Devices;
