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
import { Paper, Container, Tab, Tabs } from '@material-ui/core';
import { DeviceId } from '@nibus/core';
import React, { useState } from 'react';
import { useSelector } from '../store';
import { selectCurrentDevice } from '../store/devicesSlice';
import FirmwareTab from './FirmwareTab';
import PropertyGridTab from './PropertyGridTab';
import TelemetryTab from './TelemetryTab';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  // appBarSpacer: {
  //   flex: '0 0 auto',
  //   height: 48,
  // },
  // header: {},
  content: {
    flex: '0 1 auto',
    height: '100%',
    // height: 'calc(100% - 48px)',
    display: 'flex',
    paddingTop: theme.spacing(1),
    WebkitOverflowScrolling: 'touch', // Add iOS momentum scrolling.
  },
}));

type Props = {
  id: DeviceId;
};

type TabState = 'props' | 'telemetry' | 'firmware';

const DeviceTabs: React.FC<Props> = ({ id }) => {
  const classes = useStyles();
  const device = useSelector(selectCurrentDevice);
  const isEmpty = !device || device.isEmptyAddress;
  const [value, setValue] = useState<TabState>('props');
  // const changeHandler = useCallback((_, newValue: unknown) => {
  //   setValue(Number(newValue));
  // }, []);
  const mib = device?.mib;
  const isMinihost = mib?.startsWith('minihost');
  const isMinihost3 = mib === 'minihost3';
  // if (!isMinihost && value > 0) setValue(0);
  if (!id) return null;
  return (
    <div className={classes.root}>
      <Paper square>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, newValue) => setValue(newValue ?? 'props')}
          variant="fullWidth"
        >
          {!isEmpty && <Tab label="Свойства" disabled={isEmpty} value="props" />}
          {isMinihost && !isEmpty && (
            <Tab label="Телеметрия" disabled={isEmpty} value="telemetry" />
          )}
          {isMinihost3 && <Tab label="Прошивка" value="firmware" />}
        </Tabs>
      </Paper>
      <div className={classes.content}>
        <Container maxWidth={value !== 'telemetry' ? 'sm' : undefined} className={classes.root}>
          <PropertyGridTab id={id} selected={value === 'props'} />
          <TelemetryTab id={id} selected={value === 'telemetry'} />
          <FirmwareTab id={id} selected={value === 'firmware'} />
        </Container>
      </div>
    </div>
  );
};

export default React.memo(DeviceTabs);
