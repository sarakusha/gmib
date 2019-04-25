/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Tooltip, Typography } from '@material-ui/core';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import DeviceIcon from '@material-ui/icons/Memory';
import TvIcon from '@material-ui/icons/Tv';
import UsbIcon from '@material-ui/icons/usb';
import LinkIcon from '@material-ui/icons/link';
import { DeviceId } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback, useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';

import { useDevicesContext } from './DevicesProvier';
import { useSessionContext } from './SessionProvider';

const styles = (theme: Theme) => createStyles({
  wrapper: {
    position: 'relative',
  },
  kind: {
    color: theme.palette.primary.light,
    position: 'absolute',
    // pointerEvents: 'none',
    bottom: 0,
    right: -16,
    zIndex: 1000,
    fontSize: '1em',
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const DeviceListItems: React.FC<InnerProps> = ({ classes }) => {
  const { devices, setCurrent, current } = useDevicesContext();
  const devs = useSessionContext().devices;
  const [, setUpdate] = useState(false);
  useEffect(
    () => {
      const sernoListener = () => setUpdate(prev => !prev);
      devs.on('serno', sernoListener);
      return () => {
        devs.off('serno', sernoListener);
      };
    },
    [devs, setUpdate],
  );
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id as DeviceId || null;
      setCurrent(id);
    },
    [],
  );
  return (
    <>
      <ListSubheader inset>Устройства</ListSubheader>
      {devices.map((device) => {
        const parent = Reflect.getMetadata('parent', device);
        const mib = Reflect.getMetadata('mib', device);
        const desc = device.connection && device.connection.description || {};
        let Icon = DeviceIcon;
        if (!parent && desc.link) {
          Icon = DeviceHubIcon;
        } else if (mib && mib.startsWith('minihost')) {
          Icon = TvIcon;
        }
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
                <Icon color="inherit" />
                {parent
                  ? (<Tooltip title={parent.address.toString()}>
                    <LinkIcon className={classes.kind} />
                  </Tooltip>)
                  : (<Tooltip title={device.connection!.path}>
                      <UsbIcon className={classes.kind} />
                  </Tooltip>)}
              </div>
            </ListItemIcon>
            <ListItemText
              primary={device.address.toString()}
              secondary={Reflect.getMetadata('mib', device)}
            />
          </ListItem>
        );
      })}
    </>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(DeviceListItems);
