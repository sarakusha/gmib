/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IconButton } from '@material-ui/core';
import React from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import ReloadIcon from '@material-ui/icons/Autorenew';
import { DeviceId } from './DevicesProvier';
import { useDevice } from './DevicesStateProvider';

const styles = (theme: Theme) => createStyles({});
type Props = { current: DeviceId };
type InnerProps = Props & WithStyles<typeof styles>;
const DeviceToolbarItems: React.FC<InnerProps> = ({ classes, current }) => {
  const { reload } = useDevice(current);
  return (
    <>
      {current && <IconButton color="inherit" onClick={reload}>
        <ReloadIcon />
      </IconButton>}
    </>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(DeviceToolbarItems);
