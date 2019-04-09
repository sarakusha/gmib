/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback } from 'react';
import { hot } from 'react-hot-loader/root';
import { useDevices } from './SessionContext';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
// import TvIcon from '@material-ui/icons/Tv';

type Props = {
  setCurrent: (device: IDevice) => void,
};

const DeviceListItems = ({ setCurrent }: Props) => {
  const [devices] = useDevices();
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const index = Number(e.currentTarget.dataset.id);
      setCurrent(devices[index]);
    },
    [devices],
  );
  return (
    <>
      <ListSubheader inset>Устройства</ListSubheader>
      {devices.map((device, index) => (
        <ListItem button key={device.id} onClick={clickHandler} data-id={index}>
          <ListItemIcon>
            <DeviceHubIcon />
          </ListItemIcon>
          <ListItemText
            primary={device.address.toString()}
            secondary={Reflect.getMetadata('mib', device)}
          />
        </ListItem>
      ))}
    </>
  );
};

export default hot(DeviceListItems);
