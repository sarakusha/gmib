import { Box, Container, Paper, Tab, Tabs } from '@mui/material';
import React, { useState } from 'react';

import type { Novastar } from '../store/novastarSlice';

import NovastarDeviceTab from './NovastarDeviceTab';
import NovastarTelemetryTab from './NovastarTelemetryTab';

// const useStyles = makeStyles(theme => ({
//   root: {
//     display: 'flex',
//     flexDirection: 'column',
//     width: '100%',
//   },
//   content: {
//     flexGrow: 1,
//     // display: 'flex',
//     paddingTop: theme.spacing(1),
//     // WebkitOverflowScrolling: 'touch', // Add iOS momentum scrolling.
//   },
// }));

type TabsType = 'props' | 'telemetry';

const NovastarTabs: React.FC<{ device: Novastar | undefined }> = ({ device }) => {
  const [value, setValue] = useState<TabsType>('props');
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: 1,
      }}
    >
      <Paper square>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, newValue) => setValue(newValue ?? 'props')}
          variant="fullWidth"
        >
          <Tab label="Свойства" value="props" />
          <Tab label="Телеметрия" value="telemetry" />
        </Tabs>
      </Paper>
      <Container
        sx={{
          flexGrow: 1,
          pt: 1,
        }}
      >
        <NovastarDeviceTab device={device} selected={value === 'props'} />
        <NovastarTelemetryTab device={device} selected={value === 'telemetry'} />
      </Container>
    </Box>
  );
};

export default NovastarTabs;
