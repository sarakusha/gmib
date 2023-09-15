import { Container, Paper, Tab, Tabs } from '@mui/material';
import React, { useState } from 'react';

import FixedHeadLayout from '../../common/FixedHeadLayout';

import NovastarDeviceTab from './NovastarDeviceTab';
import NovastarTelemetryTab from './NovastarTelemetryTab';

import type { Novastar } from '/@common/novastar';

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
    <FixedHeadLayout className="yu6ODejliBoLEEgGBmOEe rlXINR-cZo5bnISD5TaUT">
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
      <Container>
        <NovastarDeviceTab device={device} selected={value === 'props'} />
        <NovastarTelemetryTab device={device} selected={value === 'telemetry'} />
      </Container>
    </FixedHeadLayout>
  );
};

export default NovastarTabs;
