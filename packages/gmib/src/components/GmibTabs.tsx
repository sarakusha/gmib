/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React, { useEffect, useState } from 'react';
// import warning from 'warning';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import DeviceTabs from './DeviceTabs';

import TabContainer, { Props as ChildProps } from './TabContainer';
import { useDevices } from './SessionContext';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
  },
});

type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

const Tabs = ({ classes }: InnerProps) => {
  const [children, setChildren] =
    useState<React.ReactElement<ChildProps, typeof TabContainer>[]>([]);
  const { current, devices } = useDevices();
  if (current) {
    let curChild = children.find(({ props }) => props.value === current);
    if (!curChild) {
      curChild = (
        <TabContainer
          key={current}
          value={current}
        >
          <DeviceTabs />
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
