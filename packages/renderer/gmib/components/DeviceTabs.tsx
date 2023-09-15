import { Container, Paper, Tab, Tabs } from '@mui/material';
import type { DeviceId } from '@nibus/core';
import React, { useState } from 'react';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import { useSelector } from '../store';
import { selectCurrentDeviceId, selectCurrentTab, selectDeviceById } from '../store/selectors';

import FirmwareTab from './FirmwareTab';
import PropertyGridTab from './PropertyGridTab';
import TelemetryTab from './TelemetryTab';

type Props = {
  id: DeviceId;
};

type TabState = 'props' | 'telemetry' | 'firmware';

const DeviceTabs: React.FC<Props> = ({ id }) => {
  const currentId = useSelector(selectCurrentDeviceId);
  const device = useSelector(state => selectDeviceById(state, id));
  const isEmpty = !device || device.isEmptyAddress;
  const [value, setValue] = useState<TabState>('props');
  const mib = device?.mib;
  const hasTelemetry = mib && ['minihost_v2.06', 'minihost_v2.06b', 'minihost3'].includes(mib);
  const isMinihost3 = mib === 'minihost3';
  const tab = useSelector(selectCurrentTab);
  if (!device || !mib) return null;
  return (
    <FixedHeadLayout>
      <Paper square>
        <Tabs
          value={tab === 'devices' && id === currentId ? value : false}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, newValue) => setValue(newValue ?? 'props')}
          variant="fullWidth"
        >
          <Tab label="Свойства" disabled={isEmpty} value="props" />
          {hasTelemetry && !isEmpty && (
            <Tab label="Телеметрия" disabled={isEmpty} value="telemetry" />
          )}
          {isMinihost3 && <Tab label="Прошивка" value="firmware" />}
        </Tabs>
      </Paper>
      <Container maxWidth={value !== 'telemetry' ? 'sm' : undefined}>
        <PropertyGridTab id={id} selected={value === 'props' && device !== undefined} />
        {hasTelemetry && (
          <TelemetryTab id={id} selected={value === 'telemetry' && device !== undefined} />
        )}
        {hasTelemetry && (
          <FirmwareTab id={id} selected={value === 'firmware' && device !== undefined} />
        )}
      </Container>
    </FixedHeadLayout>
  );
};

export default React.memo(DeviceTabs);
