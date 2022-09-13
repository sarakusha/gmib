import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useSelector } from '../store';
import {
  selectCurrentDeviceId,
  selectCurrentTab,
  selectDeviceById,
  selectDeviceIds,
  selectNovastarByPath,
} from '../store/selectors';

import Autobrightness from './Autobrightness';
import DeviceTabs from './DeviceTabs';
import Log from './Log';
// import MediaTab from './MediaTab';
import NovastarTabs from './NovastarTabs';
import OverheatProtectionTab from './OverheatProtectionTab';
// import PlaylistsTab from './PlaylistsTab';
import Screens from './Screens';
import type { Props as ChildProps } from './TabContainer';
import TabContainer from './TabContainer';

import type { DeviceId } from '@nibus/core';

const Tabs: React.FC = () => {
  const [devChildren, setDevChildren] = useState<
    React.ReactElement<ChildProps, typeof TabContainer>[]
  >([]);
  const ids = useSelector(selectDeviceIds);
  const currentDeviceId = useSelector(selectCurrentDeviceId) as DeviceId;
  const currentDevice = useSelector(state => selectDeviceById(state, currentDeviceId));
  const currentNovastar = useSelector(state => selectNovastarByPath(state, currentDeviceId));
  if (currentDevice) {
    const curChild = devChildren.find(({ props }) => props.id === currentDeviceId);
    /**
     * Создаем только те вкладки с устройствами, которые выбрали
     */
    if (!curChild) {
      setDevChildren(children =>
        children.concat(
          <TabContainer key={currentDeviceId} id={currentDeviceId}>
            <DeviceTabs id={currentDeviceId} />
          </TabContainer>,
        ),
      );
    }
  }
  const tab = useSelector(selectCurrentTab);

  /**
   * Показываем только актуальный список
   */
  useEffect(() => {
    setDevChildren(children => {
      const newChildren = children.filter(({ props }) => ids.includes(props.id));
      return newChildren.length === children.length ? children : newChildren;
    });
  }, [ids]);

  return (
    <Box sx={{ display: 'flex', width: '100%', p: 0, overflow: 'auto' }}>
      {devChildren.map(child =>
        React.cloneElement(child, {
          selected: currentDeviceId === child.props.id && tab === 'devices',
        }),
      )}
      <TabContainer id="novastar" selected={tab === 'devices' && currentNovastar !== undefined}>
        <NovastarTabs device={currentNovastar} />
      </TabContainer>
      <TabContainer id="test" selected={tab === 'screens'}>
        <Screens />
      </TabContainer>
      <TabContainer id="autobrightness" selected={tab === 'autobrightness'}>
        <Autobrightness />
      </TabContainer>
      <TabContainer id="log" selected={tab === 'log'}>
        <Log />
      </TabContainer>
      <TabContainer id="overheat" selected={tab === 'overheat'}>
        <OverheatProtectionTab />
      </TabContainer>
      {/*
      <TabContainer id="media" selected={tab === 'media'}>
        <MediaTab />
      </TabContainer>
      <TabContainer id="playlist" selected={tab === 'playlist'}>
        <PlaylistsTab />
      </TabContainer>
*/}
    </Box>
  );
};

export default Tabs;
