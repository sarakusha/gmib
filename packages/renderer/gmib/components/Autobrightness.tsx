import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  GlobalStyles,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
} from '@mui/material';
import { css, styled } from '@mui/material/styles';
import debugFactory from 'debug';
import type { SeriesSolidgaugeOptions } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import sortBy from 'lodash/sortBy';
import React, { useCallback, useEffect, useState } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import { setBrightness, setDisableNet, setSpline } from '../store/configSlice';
import {
  selectAutobrightness,
  selectBrightness,
  selectCurrentTab,
  selectDisableNet,
  selectLastIlluminance,
  selectSpline,
} from '../store/selectors';

import type { SplineItem } from '/@common/config';
import { SPLINE_COUNT } from '/@common/config';
import { noop, notEmpty, toErrorMessage } from '/@common/helpers';

import AutobrightnessToolbar from './AutobrightnessToolbar';
import Brightness from './Brightness';
import Highcharts from './Highcharts';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:autobrightness`);
const setItem =
  (index: number, value?: number) =>
  (array: (number | undefined)[]): (number | undefined)[] => {
    const clone = [...array];
    if (value !== undefined) {
      clone[index] = value;
    } else {
      delete clone[index];
    }
    return clone;
  };

const unitStyles = (
  <GlobalStyles
    styles={theme => ({
      '.unit': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(theme.typography.caption as any),
        opacity: 0.5,
      },
      '.value': {
        lineHeight: 1,
      },
      '.labelWrapper': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '6ch',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(theme.typography.subtitle1 as any),
      },
    })}
  />
);

const highChartsOptions: Highcharts.Options = {
  chart: {
    type: 'solidgauge',
    height: 180,
    width: 400,
    style: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif"',
    },
  },
  credits: {
    enabled: false,
  },
  exporting: { enabled: false },
  title: {
    text: '<div class="unit">Освещенность</div>',
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
        format: `<div class="labelWrapper">
             <div class="value">{y}</div>
             <div class="unit">Lux</div>
             </div>`,
      },
    },
  ],
};

const brightnessInputProps = {
  startAdornment: <InputAdornment position="start">%</InputAdornment>,
  inputProps: {
    min: 0,
    max: 100,
  },
};

const illuminanceInputProps = {
  startAdornment: <InputAdornment position="start">lux</InputAdornment>,
  inputProps: {
    min: 0,
    max: 65535,
  },
};

const columnStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Control = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

const Value = styled(TextField)`
  min-width: 14ch;
`;

const Autobrightness: React.FC = () => {
  const [options, setOptions] = useState<Highcharts.Options>(highChartsOptions);
  const dispatch = useDispatch();
  const illuminance = useSelector(selectLastIlluminance);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  useEffect(() => {
    if (tab === 'autobrightness') {
      setToolbar(<AutobrightnessToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [setToolbar, tab]);
  useEffect(() => {
    setOptions(prev => {
      const value = { ...prev };
      const [first] = (value.series as SeriesSolidgaugeOptions[]) ?? [];
      if (first !== undefined) first.data = [illuminance ?? null];
      return value;
    });
  }, [illuminance]);
  const [lux, setLux] = useState<(number | undefined)[]>([]);
  const [bright, setBright] = useState<(number | undefined)[]>([]);
  const spline = useSelector(selectSpline);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!changed) {
      setLux(spline ? spline.map(([l]) => l) : []);
      setBright(spline ? spline.map(([, b]) => b) : []);
    }
  }, [spline, changed]);
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
    if (errors.length === 0) {
      try {
        dispatch(setSpline(saveSpline.filter(notEmpty)));
        setChanged(false);
      } catch (e) {
        debug(`error while save spline: ${toErrorMessage(e)}`);
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
  const brightness = useSelector(selectBrightness);
  const handleBrightness = useCallback(
    (e: unknown, value: number | number[]) =>
      Array.isArray(value) || dispatch(setBrightness(value)),
    [dispatch],
  );
  const disableNet = useSelector(selectDisableNet);
  const autobrightness = useSelector(selectAutobrightness);
  return (
    <Box sx={{ pt: 1, mx: 'auto' }}>
      <Paper css={columnStyle}>
        <Control>
          {unitStyles}
          <HighchartsReact highcharts={Highcharts} options={options} />
          <Brightness
            value={brightness ?? 0}
            onChange={handleBrightness}
            disabled={autobrightness}
          />
        </Control>
        <Control>
          <Box css={columnStyle}>
            <Box
              sx={{
                p: 1,
                display: 'grid',
                gridTemplateColumns: '[lux] 1fr [brightness] 1fr [clear] auto',
                gap: 1,
              }}
            >
              {[...Array(SPLINE_COUNT).keys()].map(i => (
                <React.Fragment key={i}>
                  <Value
                    label={i === 0 ? 'Освещенность' : undefined}
                    id={`lux-${i}`}
                    value={lux[i] ?? ''}
                    type="number"
                    InputProps={illuminanceInputProps}
                    onChange={handleChange}
                    variant="standard"
                    // margin="dense"
                  />
                  <Value
                    label={i === 0 ? 'Яркость' : undefined}
                    id={`bright-${i}`}
                    value={bright[i] ?? ''}
                    type="number"
                    InputProps={brightnessInputProps}
                    onChange={handleChange}
                    // margin="dense"
                    error={!!error[i]}
                    helperText={error[i] ?? ' '}
                    variant="standard"
                  />
                  <Box sx={{ alignSelf: 'center', pb: 2 }}>
                    <IconButton size="small" onClick={handleClear} id={`clear-${i}`}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          </Box>
          <Button
            color="primary"
            startIcon={<CheckIcon />}
            variant="outlined"
            size="small"
            disabled={!changed}
            onClick={handleSave}
            sx={{ mb: 1, mr: 1, ml: 'auto', alignSelf: 'center' }}
          >
            Применить
          </Button>
        </Control>
        <Control>
          <FormControlLabel
            control={
              <Checkbox
                checked={disableNet}
                onChange={e => dispatch(setDisableNet(e.target.checked))}
                name="disableNet"
              />
            }
            label="Не использовать сетевые устройства (перезапуск)"
          />
        </Control>
      </Paper>
    </Box>
  );
};

export default React.memo(Autobrightness);
