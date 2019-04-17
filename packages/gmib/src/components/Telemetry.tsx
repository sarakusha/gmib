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

const styles = (theme: Theme) => createStyles({});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;
const Telemetry: React.FC<InnerProps> = ({ classes }: InnerProps) => {

  return (
    <div>React </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(Telemetry);
