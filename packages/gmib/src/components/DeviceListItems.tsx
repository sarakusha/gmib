/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Tooltip } from '@material-ui/core';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
// import DeviceHubIcon from '@material-ui/icons/DeviceHub';
// import DeviceIcon from '@material-ui/icons/Memory';
// import TvIcon from '@material-ui/icons/Tv';
import UsbIcon from '@material-ui/icons/Usb';
import LinkIcon from '@material-ui/icons/Link';
import { DeviceId } from '@nibus/core/lib/mib';
import React, { useCallback, useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';

import { useDevicesContext } from '../providers/DevicesProvier';
import { useSessionContext } from '../providers/SessionProvider';
import useCurrent from '../providers/useCurrent';
import DeviceIcon from './DeviceIcon';

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
    fontSize: '1em',
  },
  header: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundClip: 'padding-box',
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const DeviceListItems: React.FC<InnerProps> = ({ classes }) => {
  const { devices, current } = useDevicesContext();
  const setCurrent = useCurrent('device');
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
      <ListSubheader className={classes.header} inset>Устройства</ListSubheader>
      {devices.map((device) => {
        const parent = Reflect.getMetadata('parent', device);
        // const mib = Reflect.getMetadata('mib', device);
        const desc = device.connection && device.connection.description || {};
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
            disabled={!device.connection || device.address.isEmpty}
          >
            <ListItemIcon>
              <div className={classes.wrapper}>
                <DeviceIcon color="inherit" device={device}/>
                {parent
                  ? (<Tooltip title={parent.address.toString()}>
                    <LinkIcon className={classes.kind} />
                  </Tooltip>)
                  : device.connection && (<Tooltip title={device.connection.path}>
                  <UsbIcon className={classes.kind} />
                </Tooltip>)}
              </div>
            </ListItemIcon>
            <ListItemText
              primary={device.address.isEmpty ? desc.category : device.address.toString()}
              secondary={device.address.isEmpty
                ? device.id
                : Reflect.getMetadata('mib', device)}
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
