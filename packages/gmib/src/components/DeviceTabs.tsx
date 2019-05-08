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
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import React, { useCallback, useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import SwipeableViews from 'react-swipeable-views';
import compose from 'recompose/compose';
import { useDevicesContext } from '../providers/DevicesProvier';
import PropertyGrid from './PropertyGrid';
import TabContainer from './TabContainer';
import Telemetry from './Telemetry';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    flexShrink: 1,
    flexGrow: 1,
    maxWidth: 'none',
    flexDirection: 'column',
    // height: '100%',
    // overflow: 'hidden',
    // position: 'relative',
  },
  appBarSpacer: {
    flex: '0 0 auto',
    height: 48,
  },
  header: {},
  content: {
    flex: '1 1 auto',
    // width: '100%',
    // height: '100%',
    display: 'flex',
    WebkitOverflowScrolling: 'touch', // Add iOS momentum scrolling.
    // overflow: 'hidden',
  },
});
type Props = {
  id: string,
};
type InnerProps = Props & WithStyles<typeof styles>;

const DeviceTabs: React.FC<InnerProps> = ({ classes, id }) => {
  const { getProto } = useDevicesContext();
  const proto = getProto(id);
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
  const mib = proto && Reflect.getMetadata('mib', proto) as string;
  const isMinihost = mib && mib.startsWith('minihost');
  if (!isMinihost && value > 0) setValue(0);
  // console.log(mib, id);
  if (!id) return null;
  return (
    <div className={classes.root}>
      <AppBar position="absolute" color="default" className={classes.header}>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={changeHandler}
          variant="fullWidth"
        >
          <Tab label="Свойства" />
          {isMinihost && <Tab label="Телеметрия" />}
        </Tabs>
      </AppBar>
      <div className={classes.appBarSpacer} />
      <div className={classes.content}>
        {isMinihost ? (
            <>
              {/*<SwipeableViews index={value} onChangeIndex={swipeHandler}>*/}
              <TabContainer value={0} selected={value === 0}>
                <PropertyGrid id={id} active={value === 0} />
              </TabContainer>
              <TabContainer value={1} selected={value === 1}>
                <Telemetry id={id} active={value === 1} />
              </TabContainer>
              {/*</SwipeableViews>*/}
            </>
          )
          : (
            <TabContainer value={0} selected={true}>
              <PropertyGrid id={id} active={true} />
            </TabContainer>
          )}
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(DeviceTabs);
