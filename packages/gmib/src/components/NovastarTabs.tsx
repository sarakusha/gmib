/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Container, Paper, Tab, Tabs } from '@material-ui/core';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Novastar } from '../store/novastarsSlice';
import NovastarDeviceTab from './NovastarDeviceTab';
import NovastarTelemetryTab from './NovastarTelemetryTab';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    flexGrow: 1,
    // display: 'flex',
    paddingTop: theme.spacing(1),
    // WebkitOverflowScrolling: 'touch', // Add iOS momentum scrolling.
  },
}));

type TabsType = 'props' | 'telemetry';

const NovastarTabs: React.FC<{ device: Novastar | undefined }> = ({ device }) => {
  const classes = useStyles();
  const [value, setValue] = useState<TabsType>('props');
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
          <Tab label="Свойства" value="props" />
          <Tab label="Телеметрия" value="telemetry" />
        </Tabs>
      </Paper>
      <Container className={classes.content}>
        <NovastarDeviceTab device={device} selected={value === 'props'} />
        <NovastarTelemetryTab device={device} selected={value === 'telemetry'} />
      </Container>
    </div>
  );
};

export default NovastarTabs;
