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
import { useDevicesContext } from './DevicesProvier';
import DeviceTabs from './DeviceTabs';

import TabContainer, { Props as ChildProps } from './TabContainer';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    width: '100%',
    // flexDirection: 'column',
    overflow: 'auto',
    // alignContent: 'space-around',
    // alignItems: 'center',
    // width: '100%',
    // height: '100%',
    padding: 0,
  },
});

type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const Tabs: React.FC<InnerProps> = ({ classes }) => {
  const [children, setChildren] =
    useState<React.ReactElement<ChildProps, typeof TabContainer>[]>([]);
  const { current, devices } = useDevicesContext();
  if (current) {
    let curChild = children.find(({ props }) => props.value === current);
    if (!curChild) {
      curChild = (
        <TabContainer
          key={current}
          value={current}
        >
          <DeviceTabs id={current} />
        </TabContainer>
      );
      setChildren(children => children.concat(curChild!));
    }
  }

  useEffect(
    () => {
      setChildren((children) => {
        const newChildren = children
          .filter(({ props }) => devices.findIndex(device => device.id === props.value));
        return newChildren.length === children.length ? children : newChildren;
      });
    },
    [devices],
  );

  // console.log('CHILDREN', children.length);
  return (
    <div className={classes.root}>
      {children.map(
        child => React.cloneElement(child, { selected: current === child.props.value }))}
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(Tabs);
