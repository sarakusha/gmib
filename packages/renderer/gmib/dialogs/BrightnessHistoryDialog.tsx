import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { BrightnessHistory } from '@nibus/core';
import debugFactory from 'debug';
import type {
  SeriesLineOptions,
  XAxisOptions,
  XAxisPlotBandsOptions,
  XAxisPlotLinesOptions,
} from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import React, { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

import Highcharts from '../components/Highcharts';
import { useSelector } from '../store';

import { noop } from '/@common/helpers';

import { selectBrightness, selectLocation } from '../store/selectors';


const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:brightness`);

type Props = {
  open?: boolean;
  onClose?: () => void;
};

const highchartsOptions: Highcharts.Options = {
  title: { text: 'История' },
  time: {
    useUTC: false,
  },
  chart: {
    zooming: {
      type: 'x',
      resetButton: {
        position: {
          verticalAlign: 'bottom',
          y: 30,
        },
      },
    },
    alignTicks: false,
    style: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif"',
    },
    scrollablePlotArea: {
      minWidth: 700,
      scrollPositionX: 1,
    },
  },
  exporting: { enabled: false },
  credits: {
    enabled: false,
  },
  xAxis: {
    type: 'datetime',
  },
  yAxis: [
    {
      title: {
        text: 'Освещенность (lux)',
      },
      type: 'logarithmic',
      minorTickInterval: null,
      min: 1,
      max: 100000,
    },
    {
      title: {
        text: 'Яркость',
      },
      labels: {
        format: '{value}%',
      },
      min: 0,
      max: 100,
      opposite: true,
      tickInterval: 10,
    },
  ],
  plotOptions: {
    series: {
      stickyTracking: false,
      step: 'left',
      animation: false,
    },
    spline: {
      marker: {
        enabled: true,
      },
    },
  },
};

const getBands = (
  latitude: number,
  longitude: number,
  date = new Date(),
): [XAxisPlotBandsOptions[], XAxisPlotLinesOptions[]] => {
  const suntimes = SunCalc.getTimes(date, latitude, longitude);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  const sunrise = suntimes.sunrise && new Date(suntimes.sunrise).getTime();
  const sunriseEnd = suntimes.sunriseEnd && new Date(suntimes.sunriseEnd).getTime();
  const goldenHourEnd = suntimes.goldenHourEnd && new Date(suntimes.goldenHourEnd).getTime();
  const goldenHour = suntimes.goldenHour && new Date(suntimes.goldenHour).getTime();
  const sunsetStart = suntimes.sunsetStart && new Date(suntimes.sunsetStart).getTime();
  const sunset = suntimes.sunset && new Date(suntimes.sunset).getTime();
  const dawn = suntimes.dawn && new Date(suntimes.dawn).getTime();
  const dusk = suntimes.dusk && new Date(suntimes.dusk).getTime();
  const solarNoon = suntimes.solarNoon && new Date(suntimes.solarNoon).getTime();
  const nadir = suntimes.nadir && new Date(suntimes.nadir).getTime();
  // console.log('dusk', new Date(dusk), new Date(dawn), new Date(end));
  const plotBands: XAxisPlotBandsOptions[] = [];
  const plotLines: XAxisPlotLinesOptions[] = [];
  dawn &&
    plotBands.push({
      from: start,
      to: dawn,
      // label: { text: 'Ночь' },
      color: 'rgba(10, 10, 10, .1)',
    }); // Ночь
  sunrise &&
    plotBands.push({
      from: dawn || start,
      to: sunrise,
      // label: { text: 'Сумерки', rotation: 90, textAlign: 'left' },
      color: 'rgba(68, 100, 170, .1)',
    }); // Утренние сумерки
  sunrise &&
    sunriseEnd &&
    plotBands.push({
      from: sunrise,
      to: sunriseEnd,
      // label: { text: 'Восход', rotation: 90 },
      color: 'rgba(68, 170, 213, .2)',
    }); // Восход
  sunriseEnd &&
    goldenHourEnd &&
    plotBands.push({
      from: sunriseEnd,
      to: goldenHourEnd,
      // label: { text: 'Утро' },
      color: 'rgba(255, 180, 0, .2)',
    }); // Утро
  goldenHourEnd &&
    goldenHour &&
    plotBands.push({
      from: goldenHourEnd,
      to: goldenHour,
      // label: { text: 'День' },
      color: 'rgba(255, 255, 100, .2)',
    }); // День
  goldenHour &&
    sunsetStart &&
    plotBands.push({
      from: goldenHour,
      to: sunsetStart,
      // label: { text: 'Вечер' },
      color: 'rgba(255, 180, 0, .2)',
    }); // Вечер
  sunsetStart &&
    sunset &&
    plotBands.push({
      from: sunsetStart,
      to: sunset,
      // label: { text: 'Закат' },
      color: 'rgba(68, 170, 213, .2)',
    }); // Закат
  sunset &&
    plotBands.push({
      from: sunset,
      to: dusk || end,
      // label: { text: 'Сумерки' },
      color: 'rgba(68, 100, 170, .1)',
    }); // Вечерние сумерки
  dusk &&
    plotBands.push({
      from: dusk,
      to: end,
      // label: { text: 'Ночь' },
      color: 'rgba(10, 10, 10, .1)',
    }); // Ночь

  solarNoon &&
    plotLines.push({
      color: 'rgba(200,20,20, 0.05)',
      value: solarNoon,
      width: 5,
    });
  nadir &&
    plotLines.push({
      color: 'rgba(0, 0, 0, 0.05)',
      value: nadir,
      width: 5,
    });
  return [plotBands, plotLines];
};

// const useStyles = makeStyles({
//   table: {
//     display: 'grid',
//     gridTemplateColumns: '10ch 10ch',
//   },
//   suntimes: {
//     display: 'flex',
//     justifyContent: 'space-evenly',
//     // '& div ~ div': {
//     //   marginLeft: theme.spacing(4),
//     // },
//   },
// });

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 10ch 10ch;
`;

const BrightnessHistoryDialog: React.FC<Props> = ({ open = false, onClose = noop }) => {
  const [options, setOptions] = useState<Highcharts.Options>(highchartsOptions);
  const { latitude, longitude } = useSelector(selectLocation) ?? {};
  const isValidLocation = latitude !== undefined && longitude !== undefined;
  const currentBrightness = useSelector(selectBrightness);
  useEffect(() => {
    if (!open) return;
    let history: BrightnessHistory[] = [];
    const ts = Math.floor(Date.now() / 1000) * 1000;
    window.nibus
      .getBrightnessHistory()
      .then(
        value => {
          history = value;
        },
        err => debug(`error while get brightness history ${err.message}`),
      )
      .finally(() => {
        setOptions(opts => {
          const series = opts.series?.filter(({ yAxis }) => yAxis !== 1) ?? [];
          const data = history.map(({ timestamp, brightness }) => [
            timestamp - (timestamp % 1000),
            brightness,
          ]);
          data.push([ts, currentBrightness]);
          const brightSeries: SeriesLineOptions = {
            name: 'Яркость',
            type: 'line',
            yAxis: 1,
            tooltip: { valueSuffix: '%' },
            data,
          };
          if (isValidLocation) {
            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const xAxis = opts.xAxis as XAxisOptions;
            const [yPlotBands, yPlotLines] = getBands(latitude, longitude, yesterday);
            const [plotBands, plotLines] = getBands(latitude, longitude, now);
            xAxis.plotBands = [...yPlotBands, ...plotBands];
            xAxis.plotLines = [...yPlotLines, ...plotLines];
          }
          return {
            ...opts,
            series: series.concat(brightSeries),
          };
        });
      });
  }, [open, latitude, longitude, isValidLocation, currentBrightness]);
  const suntimes = isValidLocation ? SunCalc.getTimes(new Date(), latitude, longitude) : undefined;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullScreen>
      <DialogContent>
        <HighchartsReact highcharts={Highcharts} options={options} />
        {suntimes && (
          <Box sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
            <Grid>
              <Typography>Рассвет</Typography>
              <Typography>{suntimes.dawn.toLocaleTimeString()}</Typography>
              <Typography>Восход</Typography>
              <Typography>{suntimes.sunrise.toLocaleTimeString()}</Typography>
              <Typography>Утро</Typography>
              <Typography>{suntimes.sunriseEnd.toLocaleTimeString()}</Typography>
              <Typography>День</Typography>
              <Typography>{suntimes.goldenHourEnd.toLocaleTimeString()}</Typography>
              <Typography>Зенит</Typography>
              <Typography>{suntimes.solarNoon.toLocaleTimeString()}</Typography>
            </Grid>
            <Grid>
              <Typography>Вечер</Typography>
              <Typography>{suntimes.goldenHour.toLocaleTimeString()}</Typography>
              <Typography>Закат</Typography>
              <Typography>{suntimes.sunsetStart.toLocaleTimeString()}</Typography>
              <Typography>Сумерки</Typography>
              <Typography>{suntimes.sunset.toLocaleTimeString()}</Typography>
              <Typography>Ночь</Typography>
              <Typography>{suntimes.dusk.toLocaleTimeString()}</Typography>
              <Typography>Надир</Typography>
              <Typography>{suntimes.nadir.toLocaleTimeString()}</Typography>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          На Главную
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BrightnessHistoryDialog;
