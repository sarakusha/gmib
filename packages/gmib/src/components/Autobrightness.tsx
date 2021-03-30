/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
// import FormHelperText from '@material-ui/core/FormHelperText';
import { Paper, TextField, IconButton, InputAdornment, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Highcharts, { SeriesSolidgaugeOptions } from 'highcharts';
import highchartsMore from 'highcharts/highcharts-more';
import highchartsSolidGauge from 'highcharts/modules/solid-gauge';
import HighchartsReact from 'highcharts-react-official';
import CloseIcon from '@material-ui/icons/Close';
import CheckIcon from '@material-ui/icons/Check';
import sortBy from 'lodash/sortBy';

import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import {
  selectAutobrightness,
  selectCurrentBrightness,
  selectCurrentSpline,
  selectCurrentTab,
  setCurrentBrightness,
  setSpline,
} from '../store/currentSlice';
import { selectLastIlluminance } from '../store/sensorsSlice';
import { SPLINE_COUNT, SplineItem } from '../util/config';
import { notEmpty } from '../util/helpers';
import AutobrightnessToolbar from './AutobrightnessToolbar';
import Brightness from './Brightness';

highchartsMore(Highcharts);
highchartsSolidGauge(Highcharts);

const useStyles = makeStyles(theme => ({
  root: {
    paddingTop: theme.spacing(1),
    width: '100%',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  labelWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '6ch',
    ...theme.typography.subtitle1,
  },
  value: {
    lineHeight: 1,
  },
  unit: {
    ...theme.typography.caption,
    opacity: 0.5,
  },
  spline: {
    padding: theme.spacing(1),
    display: 'grid',
    gridTemplateColumns: '[lux] 1fr [brightness] 1fr [clear] auto',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(1),
  },
  valueItem: {
    minWidth: '14ch',
  },
  clear: {
    alignSelf: 'center',
    paddingBottom: theme.spacing(2),
  },
  control: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    // minHeight: 300,
    // width: '100%',
  },
  auto: {
    flexGrow: 1,
  },
  last: {
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
    alignSelf: 'flex-end',
  },
  // log: {
  //   display: 'flex',
  //   justifyContent: 'flex-end',
  //   alignSelf: 'flex-start',
  // },
}));

const autobrightnessToolbar = <AutobrightnessToolbar />;

const setItem = (index: number, value?: number) => (array: number[]): number[] => {
  const clone = [...array];
  if (value !== undefined) {
    clone[index] = value;
  } else {
    delete clone[index];
  }
  return clone;
};

const highChartsOptions = (classes: ReturnType<typeof useStyles>): Highcharts.Options => ({
  chart: {
    type: 'solidgauge',
    height: 180,
    width: 400,
  },
  credits: {
    enabled: false,
  },
  exporting: { enabled: false },
  title: {
    text: `<div class="${classes.unit}">Освещенность</div>`,
    useHTML: true,
  },

  pane: {
    center: ['50%', '95%'],
    size: '190%',
    startAngle: -90,
    endAngle: 90,
    background: [
      {
        backgroundColor: Highcharts.defaultOptions.legend?.backgroundColor ?? '#EEE',
        borderWidth: 1,
        innerRadius: '60%',
        outerRadius: '100%',
        shape: 'arc',
      },
    ],
  },

  tooltip: {
    enabled: false,
  },

  // the value axis
  yAxis: {
    stops: [
      [0.1, '#55BF3B'], // green
      [0.5, '#DDDF0D'], // yellow
      [0.9, '#DF5353'], // red
    ],
    lineWidth: 5,
    minorTickInterval: null,

    tickWidth: 1,
    labels: {
      y: 0,
    },
    type: 'logarithmic',
    min: 1,
    max: 65535,
  },

  plotOptions: {
    solidgauge: {
      dataLabels: {
        y: 5,
        borderWidth: 0,
        useHTML: true,
      },
    },
  },
  series: [
    {
      type: 'solidgauge',
      name: 'illuminance',
      data: [10000],
      dataLabels: {
        format: `<div class="${classes.labelWrapper}">
             <div class="${classes.value}">{y}</div>
             <div class="${classes.unit}">Lux</div>
             </div>`,
      },
    },
  ],
});

const Autobrightness: React.FC = () => {
  const classes = useStyles();
  const [options, setOptions] = useState<Highcharts.Options>(highChartsOptions(classes));
  const dispatch = useDispatch();
  const illuminance = useSelector(selectLastIlluminance);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  useEffect(() => {
    setToolbar(toolbar => {
      if (tab === 'autobrightness') return autobrightnessToolbar;
      return toolbar === autobrightnessToolbar ? null : toolbar;
    });
  }, [setToolbar, tab]);
  useEffect(() => {
    setOptions(prev => {
      const value = { ...prev };
      (value.series![0] as SeriesSolidgaugeOptions).data = [illuminance ?? null];
      return value;
    });
  }, [illuminance]);
  const [lux, setLux] = useState<(number | undefined)[]>([]);
  const [bright, setBright] = useState<(number | undefined)[]>([]);
  const spline = useSelector(selectCurrentSpline);
  useEffect(() => {
    setLux(spline ? spline.map(([l]) => l) : []);
    setBright(spline ? spline.map(([, b]) => b) : []);
  }, [spline]);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(e => {
    const { id, value } = e.target;
    const [type, index] = id.split('-', 2);
    setChanged(true);
    const val = value.trim().length > 0 ? Number(value) : undefined;
    const i = Number(index);
    switch (type) {
      case 'lux':
        setLux(setItem(i, val));
        break;
      case 'bright':
        setBright(setItem(i, val));
        break;
      default:
        break;
    }
  }, []);
  const handleSave = (): void => {
    setError([]);
    let saveSpline: (SplineItem | undefined)[] = [];
    for (let i = 0; i < SPLINE_COUNT; i += 1) {
      const curLux = lux[i];
      const curBright = bright[i];
      saveSpline[i] =
        curLux !== undefined && curBright !== undefined && curLux >= 0 && curLux <= 65535
          ? [curLux, curBright]
          : undefined;
    }
    saveSpline = sortBy(saveSpline.filter(notEmpty), ([l]) => l);
    const errors: string[] = [];
    for (let i = 0; i < saveSpline.length; i += 1) {
      const [, curBright] = saveSpline[i] as SplineItem;
      if (i > 0) {
        const [, prev] = saveSpline[i - 1] as SplineItem;
        if (prev > curBright) {
          errors[i] = 'Должно расти';
        }
      }
      if (curBright < 0 || curBright > 100) {
        errors[i] = '0..100%';
      }
    }
    // saveSpline.length = SPLINE_COUNT;
    // setLux(saveSpline.map(([l]: SplineItem) => l));
    // setBright(saveSpline.map(([, b]: SplineItem) => b));
    if (errors.length === 0) {
      try {
        dispatch(setSpline(saveSpline.filter(notEmpty)));
        setChanged(false);
      } catch (e) {
        console.error('error while save spline', e.message);
        // console.log('spline', spline);
      }
    }
    setError(errors);
  };
  const handleClear: React.MouseEventHandler<HTMLButtonElement> = e => {
    const { id } = e.currentTarget;
    const [, index] = id.split('-');
    const i = Number(index);
    setLux(setItem(i));
    setBright(setItem(i));
    setChanged(true);
  };
  const brightness = useSelector(selectCurrentBrightness);
  const handleBrightness = useCallback(
    (e: React.ChangeEvent, value: number) => {
      dispatch(setCurrentBrightness(value));
    },
    [dispatch]
  );
  const autobrightness = useSelector(selectAutobrightness);
  return (
    <div className={classNames(classes.root, classes.column)}>
      <Paper>
        <div className={classes.control}>
          <HighchartsReact highcharts={Highcharts} options={options} />
          <Brightness
            value={brightness ?? 0}
            onChange={handleBrightness}
            disabled={autobrightness}
          />
        </div>
        <div className={classes.control}>
          <div className={classNames(classes.column)}>
            <div className={classes.spline}>
              {[...Array(SPLINE_COUNT).keys()].map(i => (
                <React.Fragment key={i}>
                  <TextField
                    className={classes.valueItem}
                    label={i === 0 ? 'Освещенность' : undefined}
                    id={`lux-${i}`}
                    value={lux[i] ?? ''}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">lux</InputAdornment>,
                      inputProps: {
                        min: 0,
                        max: 65535,
                      },
                    }}
                    onChange={handleChange}
                    // margin="dense"
                  />
                  <TextField
                    className={classes.valueItem}
                    label={i === 0 ? 'Яркость' : undefined}
                    id={`bright-${i}`}
                    value={bright[i] ?? ''}
                    type="number"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">%</InputAdornment>,
                      inputProps: {
                        min: 0,
                        max: 100,
                      },
                    }}
                    onChange={handleChange}
                    // margin="dense"
                    error={!!error[i]}
                    helperText={error[i] ?? ' '}
                  />
                  <div className={classes.clear}>
                    <IconButton size="small" onClick={handleClear} id={`clear-${i}`}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {/*
            <div className={classes.log}>
              <InfoIcon opacity={0.5} />
              &nbsp;
              <FormHelperText>Шкала логарифмическая</FormHelperText>
            </div>
*/}
            <Button
              color="primary"
              startIcon={<CheckIcon />}
              variant="contained"
              size="small"
              disabled={!changed}
              onClick={handleSave}
              className={classes.last}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </Paper>
    </div>
  );
};

export default React.memo(Autobrightness);
