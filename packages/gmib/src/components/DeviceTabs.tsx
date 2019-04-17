/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { AppBar } from '@material-ui/core';
import React, { useCallback, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import SwipeableViews from 'react-swipeable-views';
import compose from 'recompose/compose';
import PropertyGrid from './PropertyGrid';
import { useCurrentDevice, useDevice, useDevices } from './SessionContext';
import TabContainer from './TabContainer';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    flexShrink: 1,
    flexGrow: 1,
    maxWidth: 'none',
    flexDirection: 'column',
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const DeviceTabs = ({ classes }: InnerProps) => {
  const { id, proto } = useCurrentDevice();
  const [value, setValue] = useState(0);
  const changeHandler = useCallback(
    (_, newValue: any) => {
      setValue(newValue);
    },
    [],
  );
  const swipeHandler = useCallback(
    (newValue: any) => {
      setValue(newValue);
    },
    [],
  );
  const mib = Reflect.getMetadata('mib', proto) as string;
  if (!id) return null;
  return (
    <div className={classes.root}>
      <AppBar position="static" color="default">
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={changeHandler}
          variant="fullWidth"
        >
          <Tab label="Свойства" />
          {mib === 'minihost3' && <Tab label="Карта" />}
        </Tabs>
      </AppBar>
      <SwipeableViews index={value} onChangeIndex={swipeHandler}>
        <TabContainer value={0} selected={true}>
          <PropertyGrid id={id}/>
        </TabContainer>
      </SwipeableViews>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(DeviceTabs);
