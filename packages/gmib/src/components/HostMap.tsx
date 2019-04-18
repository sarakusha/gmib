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
import ModuleInfo from './ModuleInfo';

const styles = (theme: Theme) => createStyles({
  card: {
    fontSize: 10,
    marginRight: theme.spacing.unit,
    '&:last-child': {
      marginRight: 0,
    },
    minWidth: 100,
  },
  root: {
    // width: '100%',
    // flex: 1,
    // overflow: 'hidden',
    // padding: theme.spacing.unit,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    // marginTop: theme.spacing.unit,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  tileRoot: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    // overflow: 'hidden',
    // backgroundColor: theme.palette.background.paper,
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const properties = {
  t: 10,
  v1: 4.56,
  v2: 3.45,
  ver: '1.23',
};

const TestMap: React.FC<InnerProps> = ({ classes }) => {
  const Row = () => (
    <div className={classes.row}>
      <ModuleInfo info={properties} x={10} y={0}/>
      <ModuleInfo info={properties} x={1} y={0}/>
      <ModuleInfo info={properties} x={12} y={0}/>
      <ModuleInfo info={properties} x={13} y={0}/>
      <ModuleInfo info={properties} x={14} y={0}/>
      <ModuleInfo info={properties} x={15} y={0}/>
    </div>
  );
  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <Row/>
        <Row/>
        <Row/>
        <Row/>
        <Row/>
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(TestMap);
