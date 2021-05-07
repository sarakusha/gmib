/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
// eslint-disable-next-line import/no-extraneous-dependencies
import { BrightnessRGBV, DisplayMode } from '@novastar/core';
import classNames from 'classnames';
import React, { useEffect } from 'react';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';
import { Novastar, reloadNovastar } from '../store/novastarsSlice';
import { noop } from '../util/helpers';
import NovastarToolbar from './NovastarToolbar';

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  paper: {
    padding: theme.spacing(1),
    minWidth: 520,
  },
  grid: {
    display: 'grid',
    gridTemplateRows: 'repeat(9, auto)',
    gridTemplateColumns: '20px 2fr 1fr 1fr 1fr 1fr',
    gap: theme.spacing(1),
  },
  itemValue: {
    gridColumnStart: 'span 4',
  },
  propertyName: {
    gridColumnStart: 'span 2',
    fontWeight: 500,
  },
  brightness: {
    gridRowStart: 'span 5',
    writingMode: 'vertical-lr',
    transform: 'rotate(180deg)',
    textAlign: 'center',
  },
  brColumns: {
    fontWeight: 500,
  },
  center: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: 500,
  },
}));

const empty = [null, null, null, null];
const brightProps: (keyof BrightnessRGBV)[] = ['overall', 'red', 'green', 'blue', 'vRed'];

const NovastarTab: React.FC<{ device: Novastar | undefined }> = ({ device }) => {
  const [, setToolbar] = useToolbar();
  const classes = useStyles();
  const tab = useSelector(selectCurrentTab);
  const selected = tab === 'devices' && device !== undefined;
  const dispatch = useDispatch();
  const path = device?.path;
  useEffect(() => {
    if (selected) {
      path && dispatch(reloadNovastar(path));
      setToolbar(<NovastarToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [selected, setToolbar, dispatch, path]);
  const ports = device?.ports ?? empty;
  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        {device && (
          <div className={classes.grid}>
            <Typography className={classes.propertyName}>Модель</Typography>
            <Typography className={classes.itemValue}>{device.model}</Typography>
            <Typography className={classes.propertyName}>Версия</Typography>
            <Typography className={classes.itemValue}>{device.version}</Typography>
            <Typography className={classes.propertyName}>DVI-сигнал на входе</Typography>
            <Typography className={classes.itemValue}>
              {device.hasDVISignalIn ? 'Да' : 'Нет'}
            </Typography>
            <Typography className={classes.propertyName}>Выход</Typography>
            <Typography className={classNames(classes.bold, classes.center)}>1</Typography>
            <Typography className={classNames(classes.bold, classes.center)}>2</Typography>
            <Typography className={classNames(classes.bold, classes.center)}>3</Typography>
            <Typography className={classNames(classes.bold, classes.center)}>4</Typography>
            <Typography className={classes.propertyName}>Режим</Typography>
            {ports.map((port, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Typography key={index} className={classes.center}>
                {port ? DisplayMode[port.displayMode] ?? 'Unknown' : '-'}
              </Typography>
            ))}
            <Typography className={classNames(classes.brightness, classes.brColumns)}>
              Яркость
            </Typography>
            {brightProps.map(name => (
              <React.Fragment key={name}>
                <Typography className={classes.brColumns}>{name}</Typography>
                {ports.map((port, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Typography key={index} className={classes.center}>
                    {port ? port.brightness[name] : '-'}
                  </Typography>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
      </Paper>
    </div>
  );
};

export default NovastarTab;
