/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { makeStyles } from '@material-ui/core/styles';
import React, { useEffect, useState } from 'react';
import { useDevices, useSelector } from '../store';
import { selectCurrentDeviceId, selectCurrentTab } from '../store/currentSlice';
import DeviceTabs from './DeviceTabs';

import TabContainer, { Props as ChildProps } from './TabContainer';
import TestParams from './TestParams';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    width: '100%',
    overflow: 'auto',
    padding: 0,
  },
});

const Tabs: React.FC = () => {
  const classes = useStyles();
  const [devChildren, setDevChildren] = useState<
    React.ReactElement<ChildProps, typeof TabContainer>[]
  >([]);
  const devices = useDevices();
  const currentDevice = useSelector(selectCurrentDeviceId);
  if (currentDevice) {
    let curChild = devChildren.find(({ props }) => props.id === currentDevice);
    if (!curChild) {
      curChild = (
        <TabContainer key={currentDevice} id={currentDevice}>
          <DeviceTabs id={currentDevice} />
        </TabContainer>
      );
      setDevChildren(children => children.concat(curChild!));
    }
  }
  const tab = useSelector(selectCurrentTab);

  /**
   * Показываем только актуальный список
   */
  useEffect(() => {
    setDevChildren(children => {
      const newChildren = children.filter(({ props }) =>
        devices.findIndex(device => device.id === props.id)
      );
      return newChildren.length === children.length ? children : newChildren;
    });
  }, [devices]);

  return (
    <div className={classes.root}>
      {devChildren.map(child =>
        React.cloneElement(child, {
          selected: currentDevice === child.props.id && tab === 'devices',
        })
      )}
      <TabContainer id="test" selected={tab === 'tests'}>
        <TestParams />
      </TabContainer>
      {/* <TabContainer id="autobrightness" selected={false}></TabContainer> */}
    </div>
  );
};

export default Tabs;
