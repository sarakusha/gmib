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
  TextField,
  Typography,
} from '@mui/material';
import { css, styled } from '@mui/material/styles';
import debugFactory from 'debug';
import type { SeriesSolidgaugeOptions } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import sortBy from 'lodash/sortBy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SunCalc from 'suncalc';

import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import {
  setBrightness,
  setDisableNet,
  setNightMode,
  setSpline,
  setSunSpline,
} from '../store/configSlice';
import {
  selectAutobrightness,
  selectBrightness,
  selectCurrentTab,
  selectDisableNet,
  selectLastIlluminance,
  selectLocation,
  selectNightMode,
  selectSpline,
  selectSunSpline,
} from '../store/selectors';

import type { NightBrightnessMode, SplineItem, SunEvent, SunSplineItem } from '/@common/config';
import { SPLINE_COUNT, sunEventLabels, sunEvents } from '/@common/config';
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
        clone[index] = undefined;
      }
      return clone;
    };

const unitStyles = (
  <GlobalStyles
    styles={theme => ({
      '.unit': {
        ...(theme.typography.caption as object),
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

        ...(theme.typography.subtitle1 as object),
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

const columnStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Control = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
}));

const fieldSx = {
  '& .MuiInputBase-root': {
    height: 32,
  },
  '& .MuiFormHelperText-root': {
    minHeight: 16,
    mt: 0.25,
  },
};
const valueSx = { ...fieldSx, width: '10ch' };
const luxSx = { ...fieldSx, width: '12ch' };
const timeSx = { ...fieldSx, width: '10ch' };
const sectionSx = { width: 360 };
const compactGridSx = {
  p: 0.5,
  columnGap: 1,
  rowGap: 0,
  alignItems: 'start',
};
const rowTextSx = {
  height: 32,
  display: 'flex',
  alignItems: 'center',
  mt: 2,
  // mb: 2.25,
};
const clearCellSx = { alignSelf: 'start', pt: 2.5 };
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const minuteMs = 60 * 1000;

type SunEventRow = {
  event: SunEvent;
  time?: number;
};

type NightModeState = Record<keyof Required<NightBrightnessMode>, string>;
type NightModeError = Partial<Record<keyof NightModeState, string>>;
type SunBrightnessState = Partial<Record<SunEvent, number | undefined>>;

const getTimeOfDay = (date: Date): number =>
  (date.getHours() * 60 + date.getMinutes()) * minuteMs +
  date.getSeconds() * 1000 +
  date.getMilliseconds();

const formatTime = (value?: number): string => {
  if (value === undefined) return 'N/A';
  const hours = Math.floor(value / (60 * minuteMs));
  const minutes = Math.floor((value % (60 * minuteMs)) / minuteMs);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const getSunEventRows = (latitude?: number, longitude?: number): SunEventRow[] => {
  if (latitude === undefined || longitude === undefined)
    return sunEvents.map(event => ({ event }));

  const times = SunCalc.getTimes(new Date(), latitude, longitude);
  return sunEvents
    .map(event => {
      const date = times[event];
      return {
        event,
        time:
          date instanceof Date && !Number.isNaN(date.getTime()) ? getTimeOfDay(date) : undefined,
      };
    })
    .sort((a, b) => (a.time ?? Number.MAX_SAFE_INTEGER) - (b.time ?? Number.MAX_SAFE_INTEGER));
};

const isMonotonicUpThenDown = (values: Array<[index: number, brightness: number]>): number[] => {
  const errors: number[] = [];
  let descending = false;
  for (let i = 1; i < values.length; i += 1) {
    const [index, current] = values[i];
    const [, previous] = values[i - 1];
    if (current < previous) {
      descending = true;
    } else if (descending && current > previous) {
      errors.push(index);
    }
  }
  return errors;
};

const getNightState = (nightMode?: NightBrightnessMode): NightModeState => ({
  start: nightMode?.start ?? '',
  end: nightMode?.end ?? '',
  brightness: nightMode?.brightness?.toString() ?? '',
});

const parseNightMode = (night: NightModeState): [NightBrightnessMode | undefined, NightModeError] => {
  const start = night.start.trim();
  const end = night.end.trim();
  const brightnessText = night.brightness.trim();
  const hasAnyNightValue = start.length > 0 || end.length > 0 || brightnessText.length > 0;
  if (!hasAnyNightValue) return [undefined, {}];

  const errors: NightModeError = {};
  if (!timePattern.test(start)) errors.start = 'HH:MM';
  if (!timePattern.test(end)) errors.end = 'HH:MM';

  const brightness = Number(brightnessText);
  if (brightnessText.length === 0 || Number.isNaN(brightness)) {
    errors.brightness = '0..100%';
  } else if (brightness < 0 || brightness > 100) {
    errors.brightness = '0..100%';
  }

  return [
    Object.keys(errors).length === 0 ? { start, end, brightness } : undefined,
    errors,
  ];
};

const percentUnit = {
  input: {
    startAdornment: <InputAdornment position="start">%</InputAdornment>,
  },
} as const;

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
  const [sunBright, setSunBright] = useState<SunBrightnessState>({});
  const [night, setNight] = useState<NightModeState>(getNightState());
  const spline = useSelector(selectSpline);
  const sunSpline = useSelector(selectSunSpline);
  const location = useSelector(selectLocation);
  const nightMode = useSelector(selectNightMode);
  const sunRows = useMemo(
    () => getSunEventRows(location?.latitude, location?.longitude),
    [location?.latitude, location?.longitude],
  );
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!changed) {
      setLux(spline ? spline.map(([l]) => l) : []);
      setBright(spline ? spline.map(([, b]) => b) : []);
      setSunBright(
        (sunSpline ?? []).reduce<SunBrightnessState>((acc, [reference, brightnessValue]) => {
          if (reference.startsWith('event:')) {
            const event = reference.slice('event:'.length) as SunEvent;
            if (sunEvents.includes(event)) return { ...acc, [event]: brightnessValue };
          }
          return acc;
        }, {}),
      );
      setNight(getNightState(nightMode));
    }
  }, [spline, sunSpline, nightMode, changed]);
  const [error, setError] = useState<string[]>([]);
  const [sunError, setSunError] = useState<string[]>([]);
  const [nightError, setNightError] = useState<NightModeError>({});
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
      case 'sunBright':
        setSunBright(prev => ({ ...prev, [index as SunEvent]: val }));
        break;
      case 'night':
        setNight(prev => ({ ...prev, [index as keyof NightModeState]: value }));
        break;
      default:
        break;
    }
  }, []);
  const handleSave = (): void => {
    setError([]);
    setSunError([]);
    setNightError({});
    let saveSpline: (SplineItem | undefined)[] = [];
    for (let i = 0; i < SPLINE_COUNT; i += 1) {
      const curLux = lux[i];
      const curBright = bright[i];
      saveSpline[i] =
        curLux !== undefined && curBright !== undefined && curLux >= 0 && curLux <= 65535
          ? [curLux, curBright]
          : undefined;
    }
    const definedSun = sunRows
      .map(({ event }, index) => {
        const brightnessValue = sunBright[event];
        return brightnessValue === undefined ? undefined : { index, event, brightnessValue };
      })
      .filter(notEmpty);
    const saveSunSpline = definedSun.map<SunSplineItem>(({ event, brightnessValue }) => [
      `event:${event}`,
      brightnessValue,
    ]);
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
    const sunErrors: string[] = [];
    definedSun.forEach(({ index, brightnessValue }) => {
      if (Number.isNaN(brightnessValue) || brightnessValue < 0 || brightnessValue > 100) {
        sunErrors[index] = '0..100%';
      }
    });
    isMonotonicUpThenDown(
      definedSun.map(({ index, brightnessValue }) => [index, brightnessValue]),
    ).forEach(index => {
      if (sunErrors[index] === undefined) sunErrors[index] = 'Рост, затем спад';
    });
    const [saveNightMode, nightErrors] = parseNightMode(night);
    if (
      errors.length === 0 &&
      sunErrors.length === 0 &&
      Object.keys(nightErrors).length === 0
    ) {
      try {
        dispatch(setSpline(saveSpline.filter(notEmpty)));
        dispatch(setSunSpline(saveSunSpline));
        dispatch(setNightMode(saveNightMode));
        setChanged(false);
      } catch (e) {
        debug(`error while save spline: ${toErrorMessage(e)}`);
      }
    }
    setError(errors);
    setSunError(sunErrors);
    setNightError(nightErrors);
  };
  const handleClear: React.MouseEventHandler<HTMLButtonElement> = e => {
    const { id } = e.currentTarget;
    const [, index] = id.split('-');
    const i = Number(index);
    setLux(setItem(i));
    setBright(setItem(i));
    setChanged(true);
  };
  const handleSunClear: React.MouseEventHandler<HTMLButtonElement> = e => {
    const { id } = e.currentTarget;
    const [, event] = id.split('-', 2);
    setSunBright(prev => ({ ...prev, [event as SunEvent]: undefined }));
    setChanged(true);
  };
  const handleNightClear = (): void => {
    setNight(getNightState());
    setNightError({});
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
    <Box sx={{ pt: 1, mx: 'auto' }} className="YqATOnK8rERXOjt0JEXW0 rlXINR-cZo5bnISD5TaUT">
      <Box css={columnStyle}>
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
          <Box css={columnStyle} sx={sectionSx}>
            <Typography variant="h6">По освещенности</Typography>
            <Box
              sx={{
                ...compactGridSx,
                display: 'grid',
                gridTemplateColumns: '[lux] 12ch [brightness] 10ch [clear] auto',
              }}
            >
              {[...Array(SPLINE_COUNT).keys()].map(i => (
                <React.Fragment key={i}>
                  <TextField
                    label={i === 0 ? 'Освещенность' : ' '}
                    id={`lux-${i}`}
                    value={lux[i] ?? ''}
                    type="number"
                    onChange={handleChange}
                    helperText=" "
                    sx={luxSx}
                    variant="standard"
                    size="small"
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">lux</InputAdornment>,
                      },
                    }}
                  // margin="dense"
                  />
                  <TextField
                    label={i === 0 ? 'Яркость' : ' '}
                    id={`bright-${i}`}
                    value={bright[i] ?? ''}
                    type="number"
                    onChange={handleChange}
                    // margin="dense"
                    error={!!error[i]}
                    helperText={error[i] ?? ' '}
                    sx={valueSx}
                    variant="standard"
                    size="small"
                    slotProps={percentUnit}
                  />
                  <Box sx={clearCellSx}>
                    <IconButton size="small" onClick={handleClear} id={`clear-${i}`}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Control>
        <Control>
          <Box css={columnStyle} sx={sectionSx}>
            <Typography variant="h6">По времени суток</Typography>
            <Box
              sx={{
                ...compactGridSx,
                display: 'grid',
                gridTemplateColumns:
                  '[event] 11ch [time] 7ch [brightness] 10ch [clear] auto',
              }}
            >
              {sunRows.map(({ event, time }, i) => (
                <React.Fragment key={event}>
                  <Typography sx={rowTextSx} variant="body1">
                    {sunEventLabels[event]}
                  </Typography>
                  <Typography
                    sx={rowTextSx}
                    color={time === undefined ? 'text.disabled' : 'text.secondary'}
                    variant="body1"
                  >
                    {formatTime(time)}
                  </Typography>
                  <TextField
                    label={i === 0 ? 'Яркость' : ' '}
                    id={`sunBright-${event}`}
                    value={sunBright[event] ?? ''}
                    type="number"
                    onChange={handleChange}
                    error={!!sunError[i]}
                    helperText={sunError[i] ?? ' '}
                    sx={valueSx}
                    variant="standard"
                    size="small"
                    slotProps={percentUnit}
                  />
                  <Box sx={clearCellSx}>
                    <IconButton size="small" onClick={handleSunClear} id={`sun-${event}`}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
            <Typography variant="subtitle2">Ночной режим</Typography>
            <Box
              sx={{
                ...compactGridSx,
                display: 'grid',
                gridTemplateColumns: '[start] 10ch [end] 10ch [brightness] 10ch [unit] 2ch [clear] auto',
              }}
            >
              <TextField
                label="Начало"
                id="night-start"
                value={night.start}
                type="time"
                onChange={handleChange}
                error={!!nightError.start}
                helperText={nightError.start ?? ' '}
                sx={timeSx}
                variant="standard"
                size="small"
              />
              <TextField
                label="Конец"
                id="night-end"
                value={night.end}
                type="time"
                onChange={handleChange}
                error={!!nightError.end}
                helperText={nightError.end ?? ' '}
                sx={timeSx}
                variant="standard"
                size="small"
              />
              <TextField
                label="Яркость"
                id="night-brightness"
                value={night.brightness}
                type="number"
                onChange={handleChange}
                error={!!nightError.brightness}
                helperText={nightError.brightness ?? ' '}
                sx={valueSx}
                variant="standard"
                size="small"
                slotProps={percentUnit}
              />
              <Box sx={clearCellSx}>
                <IconButton size="small" onClick={handleNightClear}>
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Control>
        <Control>
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
      </Box>
    </Box>
  );
};

export default React.memo(Autobrightness);
