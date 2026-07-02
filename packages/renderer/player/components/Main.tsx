import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
// import TabPanel from '@mui/lab/TabPanel';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import React from 'react';

import { useDispatch, useSelector } from '../store';
import { setCurrentTab, tabNames, tabs } from '../store/currentSlice';
import type { TabNames } from '../store/currentSlice';
import { selectCurrentTab } from '../store/selectors';

import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';

import MediaTab from './MediaTab';
import PlaylistsTab from './PlaylistsTab';
import SchedulerTab from './SchedulerTab';
import SettingsTab from './SettingsTab';
import TabPanel from './TabPanel';

const Main: React.FC<{ className?: string }> = ({ className }) => {
  const value = useSelector(selectCurrentTab);
  const dispatch = useDispatch();
  const isSchedulerSupported = supportsFeature('playerScheduler', version, isRemoteSession);
  const visibleTabNames = React.useMemo(
    () => tabNames.filter(name => name !== 'scheduler' || isSchedulerSupported),
    [isSchedulerSupported],
  );
  const handleChange = (event: React.SyntheticEvent, newValue: TabNames) => {
    dispatch(setCurrentTab(newValue));
  };
  React.useEffect(() => {
    if (value === 'scheduler' && !isSchedulerSupported) dispatch(setCurrentTab('player'));
  }, [dispatch, isSchedulerSupported, value]);
  return (
    <TabContext value={value}>
      <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          className={className}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <TabList onChange={handleChange} aria-label="panels" centered>
            {visibleTabNames.map(name => (
              <Tab label={tabs[name]} key={name} value={name} />
            ))}
          </TabList>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TabPanel value="player">
            <PlaylistsTab />
          </TabPanel>
          <TabPanel value="media">
            <MediaTab />
          </TabPanel>
          {isSchedulerSupported && (
            <TabPanel value="scheduler">
              <SchedulerTab />
            </TabPanel>
          )}
          <TabPanel value="settings">
            <SettingsTab />
          </TabPanel>
        </Box>
      </Box>
    </TabContext>
  );
};

Main.displayName = 'Main';

export default Main;
