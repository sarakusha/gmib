/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { SvgIconProps } from '@material-ui/core/SvgIcon';
import { IDevice } from '@nibus/core';
import React from 'react';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import HubIcon from '@material-ui/icons/DeviceHub';
import DefaultIcon from '@material-ui/icons/Memory';
import MinihostIcon from '@material-ui/icons/Tv';
import ConsoleIcon from '@material-ui/icons/VideogameAsset';

type Props = {
  device?: IDevice;
  mib?: string;
} & SvgIconProps;
const DeviceIcon: React.FC<Props> = ({ device, mib, ...props }) => {
  const parent = device && Reflect.getMetadata('parent', device);
  const safeMib: string = mib || Reflect.getMetadata('mib', device || {});
  if (!safeMib) console.warn('Invalid mib or device');
  let Icon = DefaultIcon;
  if (!parent && device && device.connection && device.connection.description.link) {
    Icon = HubIcon;
  } else if (safeMib && safeMib.includes('console')) {
    Icon = ConsoleIcon;
  } else if (safeMib && safeMib.includes('minihost')) {
    Icon = MinihostIcon;
  }
  return <Icon {...props} />;
};

export default compose<Props, Props>(
  hot,
  React.memo,
)(DeviceIcon);
