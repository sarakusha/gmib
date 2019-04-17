/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import { DeviceId } from './DevicesProvier';

const styles = (theme: Theme) => createStyles({});
type Props = { current: DeviceId };
type InnerProps = Props & WithStyles<typeof styles>;
const DeviceToolbar: React.FC<InnerProps> = ({ classes, current }: InnerProps) => {
  const { proto }
  return (
    <div>React</div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(DeviceToolbar);

