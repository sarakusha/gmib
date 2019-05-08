/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
// import warning from 'warning';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import { useDevicesContext } from '../providers/DevicesProvier';
import { useTests } from '../providers/TestProvider';
import DeviceTabs from './DeviceTabs';

import TabContainer, { Props as ChildProps } from './TabContainer';
import TestParams from './TestParams';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    width: '100%',
    overflow: 'auto',
    padding: 0,
  },
});

type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const Tabs: React.FC<InnerProps> = ({ classes }) => {
  const [devChildren, setDevChildren] =
    useState<React.ReactElement<ChildProps, typeof TabContainer>[]>([]);
  const { current: currentDevice, devices } = useDevicesContext();
  if (currentDevice) {
    let curChild = devChildren.find(({ props }) => props.value === currentDevice);
    if (!curChild) {
      curChild = (
        <TabContainer
          key={currentDevice}
          value={currentDevice}
        >
          <DeviceTabs id={currentDevice} />
        </TabContainer>
      );
      setDevChildren(children => children.concat(curChild!));
    }
  }
  const { current: currentTest } = useTests();

  /**
   * Показываем только актуальный список
   */
  useEffect(
    () => {
      setDevChildren((children) => {
        const newChildren = children
          .filter(({ props }) => devices.findIndex(device => device.id === props.value));
        return newChildren.length === children.length ? children : newChildren;
      });
    },
    [devices],
  );

  return (
    <div className={classes.root}>
      {devChildren.map(
        child => React.cloneElement(child, { selected: currentDevice === child.props.value }))}
      <TabContainer value="test" selected={!!currentTest}>
        <TestParams/>
      </TabContainer>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(Tabs);
