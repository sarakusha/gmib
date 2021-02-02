/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Container from '@material-ui/core/Container';
import AppBar from '@material-ui/core/AppBar';
import { makeStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import React, { useCallback, useState } from 'react';
import { useSelector } from '../store';
import { selectCurrentDevice } from '../store/currentSlice';
import FirmwareTab from './FirmwareTab';
import PropertyGridTab from './PropertyGridTab';
import TelemetryTab from './TelemetryTab';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  appBarSpacer: {
    flex: '0 0 auto',
    height: 48,
  },
  header: {},
  content: {
    flex: '0 1 auto',
    height: 'calc(100% - 48px)',
    display: 'flex',
    paddingTop: theme.spacing(1),
    WebkitOverflowScrolling: 'touch', // Add iOS momentum scrolling.
  },
}));

type Props = {
  id: string;
};

const DeviceTabs: React.FC<Props> = ({ id }) => {
  const classes = useStyles();
  const device = useSelector(selectCurrentDevice);
  const isEmpty = !device || device.isEmptyAddress;
  const [value, setValue] = useState(0);
  const changeHandler = useCallback((_, newValue: unknown) => {
    setValue(Number(newValue));
  }, []);
  const mib = device?.mib;
  const isMinihost = mib?.startsWith('minihost');
  const isMinihost3 = mib === 'minihost3';
  if (!isMinihost && value > 0) setValue(0);
  if (!id) return null;
  return (
    <div className={classes.root}>
      <AppBar position="absolute" color="default" className={classes.header}>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={changeHandler}
          variant="fullWidth"
        >
          {!isEmpty && <Tab label="Свойства" disabled={isEmpty} />}
          {isMinihost && !isEmpty && <Tab label="Телеметрия" disabled={isEmpty} />}
          {isMinihost3 && <Tab label="Прошивка" />}
        </Tabs>
      </AppBar>
      <div className={classes.appBarSpacer} />
      <div className={classes.content}>
        <Container maxWidth={value !== 1 ? 'sm' : undefined} className={classes.root}>
          {isMinihost ? (
            <>
              {!isEmpty && (
                <>
                  <PropertyGridTab id={id} selected={value === 0} />
                  <TelemetryTab id={id} selected={value === 1} />
                </>
              )}
              {isMinihost3 && <FirmwareTab id={id} selected={value === 2 || isEmpty} />}
            </>
          ) : (
            <PropertyGridTab id={id} selected />
          )}
        </Container>
      </div>
    </div>
  );
};

export default React.memo(DeviceTabs);
