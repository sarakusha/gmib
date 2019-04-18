/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import DeviceIcon from '@material-ui/icons/Memory';
import TvIcon from '@material-ui/icons/Tv';
import { DeviceId } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback } from 'react';
import { hot } from 'react-hot-loader/root';
import { useDevicesContext } from './DevicesProvier';

const DeviceListItems: React.FC<{}> = () => {
  const { devices, setCurrent, current } = useDevicesContext();
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
        const desc = device.connection && device.connection.description || {};
        let Icon = DeviceIcon;
        if (desc.link) {
          Icon = DeviceHubIcon;
        } else if (desc.mib && desc.mib.startsWith('minihost')) {
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
              <Icon />
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

export default hot(DeviceListItems);
