/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React from 'react';
import HubIcon from '@mui/icons-material/DeviceHub';
import DefaultIcon from '@mui/icons-material/Memory';
import MinihostIcon from '@mui/icons-material/Tv';
import ConsoleIcon from '@mui/icons-material/VideogameAsset';
import type { SvgIconProps } from '@mui/material';
import { DeviceState, DeviceStateWithParent } from '../store/devicesSlice';

type Props = {
  device?: DeviceStateWithParent | DeviceState;
  mib?: string;
} & SvgIconProps;
const DeviceIcon: React.FC<Props> = ({ device, mib, ...props }) => {
  const parent = device?.parent;
  const safeMib = device?.mib ?? mib;
  // if (!safeMib) console.warn('Invalid mib or device');
  let Icon = DefaultIcon;
  if (safeMib && safeMib.includes('console')) {
    Icon = ConsoleIcon;
  } else if (safeMib && safeMib.includes('minihost')) {
    Icon = MinihostIcon;
  } else if (!parent && device?.isLinkingDevice) {
    Icon = HubIcon;
  }
  return <Icon {...props} />;
};

export default React.memo(DeviceIcon);
