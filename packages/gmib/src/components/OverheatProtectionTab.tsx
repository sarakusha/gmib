/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { InputAdornment, Paper, TextField, MenuItem, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from '../store';
import { selectOverheatProtection, selectScreens } from '../store/configSlice';
import setProtectionProp from '../store/healthThunks';
import { selectCurrentHealth } from '../store/currentSlice';
import { DEFAULT_OVERHEAD_PROTECTION, OverheatProtection } from '../util/config';
import { findById, toNumber } from '../util/helpers';
import FormFieldSet from './FormFieldSet';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1),
    marginLeft: 'auto',
    marginRight: 'auto',
    '& > div ~ div': {
      marginTop: theme.spacing(1),
    },
  },
  content: {
    padding: theme.spacing(1),
  },
  params: {
    display: 'flex',
    flexWrap: 'wrap',
    // flexDirection: 'column',
    gap: theme.spacing(1),
    '& > *': {
      width: '18ch',
    },
  },
  screens: {
    // position: 'relative',
    // padding: theme.spacing(1),
    // paddingTop: '5ch',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  screen: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    borderColor: 'rgba(0, 0, 0, 0.23)',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  wrapper: {
    display: 'grid',
    gridTemplateColumns: '14ch 5ch',
    gridTemplateRows: 'auto',
    gap: theme.spacing(1),
  },
  value: {
    marginLeft: 'auto',
  },
  empty: {
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  timestamp: {
    // position: 'absolute',
    // left: theme.spacing(1),
    // top: theme.spacing(1),
  },
}));

const intervalInputProps = {
  startAdornment: <InputAdornment position="start">минуты</InputAdornment>,
  inputProps: {
    min: 0,
    max: 30,
  },
};

const stepInputProps = {
  startAdornment: <InputAdornment position="start">%</InputAdornment>,
  inputProps: {
    min: 3,
    max: 20,
  },
};

const OverheatProtectionTab: React.FC = () => {
  const classes = useStyles();
  const { interval, step, upperBound, bottomBound, aggregation } =
    useSelector(selectOverheatProtection) ?? DEFAULT_OVERHEAD_PROTECTION;
  const dispatch = useDispatch();
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value, id } = e.currentTarget;
      const res = toNumber(value) ?? 0;
      if (res !== undefined && !Number.isNaN(res)) {
        dispatch(setProtectionProp([id as keyof OverheatProtection, res]));
      }
    },
    [dispatch]
  );
  // const health: Health = {
  //   screens: {
  //     test: {
  //       aggregations: [120, 70, 60],
  //     },
  //     test2: {
  //       aggregations: [120, 70, 60],
  //     },
  //   },
  //   timestamp: Date.now(),
  // }; //
  const health = useSelector(selectCurrentHealth);
  const screens = useSelector(selectScreens);
  return (
    <div className={classes.root}>
      <Paper className={classes.content}>
        <div className={classes.params}>
          <TextField
            id="interval"
            label="Интервал"
            value={interval}
            type="number"
            InputProps={intervalInputProps}
            onChange={handleChange}
          />
          <TextField
            id="step"
            label="Шаг понижения"
            value={step}
            type="number"
            InputProps={stepInputProps}
            onChange={handleChange}
          />
          <TextField
            id="aggregation"
            select
            label="Температура"
            value={aggregation}
            onChange={e => {
              dispatch(setProtectionProp(['aggregation', Number(e.target.value)]));
            }}
          >
            <MenuItem value={0}>Максимальная</MenuItem>
            <MenuItem value={1}>Средняя</MenuItem>
            <MenuItem value={2}>Медиана</MenuItem>
          </TextField>
          <TextField
            id="bottomBound"
            label="Нижняя граница"
            value={bottomBound}
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">&deg;C</InputAdornment>,
              inputProps: {
                min: 30,
                max: upperBound,
              },
            }}
            onChange={handleChange}
          />
          <TextField
            id="upperBound"
            label="Верхняя граница"
            value={upperBound}
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">&deg;C</InputAdornment>,
              inputProps: {
                min: bottomBound,
                max: 120,
              },
            }}
            onChange={handleChange}
          />
        </div>
      </Paper>
      {health && Object.keys(health.screens).length > 0 && (
        <Paper className={classes.content}>
          {health.timestamp && (
            <Typography className={classes.timestamp} paragraph>
              Состояние на {new Date(health.timestamp).toLocaleString()}
            </Typography>
          )}
          <div className={classes.screens}>
            {Object.entries(health.screens).map(([id, screenHealth]) => {
              const [maximum, average, median] = screenHealth.aggregations;
              return (
                <FormFieldSet
                  key={id}
                  className={classes.screen}
                  legend={findById(screens, id)?.name ?? id}
                >
                  <div className={classes.wrapper}>
                    <div>Максимальная</div>
                    <div className={classes.value}>{maximum}&deg;C</div>
                    <div>Средняя</div>
                    <div className={classes.value}>{average}&deg;C</div>
                    <div>Медиана</div>
                    <div className={classes.value}>{median}&deg;C</div>
                    <div>Ограничение</div>
                    <div className={screenHealth.maxBrightness ? classes.value : classes.empty}>
                      {screenHealth.maxBrightness ? `${screenHealth.maxBrightness}%` : '-'}
                    </div>
                  </div>
                </FormFieldSet>
              );
            })}
          </div>
        </Paper>
      )}
    </div>
  );
};

export default OverheatProtectionTab;
