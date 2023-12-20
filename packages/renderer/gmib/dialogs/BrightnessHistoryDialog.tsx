import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
// import debugFactory from 'debug';
import type {
  SeriesLineOptions,
  XAxisOptions,
  XAxisPlotBandsOptions,
  XAxisPlotLinesOptions,
} from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import groupBy from 'lodash/groupBy';
import React, { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

import Highcharts from '../components/Highcharts';
import { useSelector } from '../store';

import type { SensorsData } from '/@common/helpers';
import { noop } from '/@common/helpers';
import { host, isRemoteSession, port } from '/@common/remote';

import { selectBrightness, selectLastWithAddress, selectLocation } from '../store/selectors';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:brightness`);

type Props = {
  open?: boolean;
  onClose?: () => void;
};

type Sensors = SensorsData & { time: number };

const apiUrl = host && port ? `http://${host}:${+port + 1}/api` : '/api';
const sensorsUrl = `${apiUrl}/sensors`;

const getSensors = async (): Promise<Sensors[]> => {
  const headers = new Headers();
  if (isRemoteSession) {
    const now = Date.now();
    const signature = window.identify.generateSignature('GET', sensorsUrl, now);
    if (signature) {
      const identifier = window.identify.getIdentifier();
      identifier && headers.set('x-ni-identifier', identifier);
      headers.set('x-ni-timestamp', now.toString());
      headers.set('x-ni-signature', signature);
    }
  } else {
    const secret = window.identify.getSecret();
    headers.set('authorization', `Bearer ${secret}`);
  }
  const res = await fetch(sensorsUrl, { headers });
  if (!res.ok) return [];
  return res.json();
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
      animation: false,
    },
    spline: {
      marker: {
        enabled: true,
      },
    },
  },
  series: [
    {
      type: 'line',
      step: 'left',
    },
  ],
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

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 10ch 10ch;
`;

const BrightnessHistoryDialog: React.FC<Props> = ({ open = false, onClose = noop }) => {
  const [options, setOptions] = useState<Highcharts.Options>(highchartsOptions);
  const { latitude, longitude } = useSelector(selectLocation) ?? {};
  const isValidLocation = latitude !== undefined && longitude !== undefined;
  const currentBrightness = useSelector(selectBrightness);
  const lastIlluminance = useSelector(state => selectLastWithAddress(state, 'illuminance'));
  useEffect(() => {
    if (!open) return;
    Promise.all([window.nibus.getBrightnessHistory(), getSensors()]).then(([history, sensors]) => {
      setOptions(opts => {
        const series = Object.entries(
          groupBy(
            sensors.filter(({ illuminance }) => illuminance != null),
            'address',
          ),
        ).map(
          ([address, values]) =>
            ({
              id: `illuminance:${address}`,
              name: `Освещенность ${address}`,
              yAxis: 0,
              type: 'line',
              tooltip: { valueSuffix: ' lux' },
              color: '#FF8000',
              shadow: true,
              data: values.map(({ time, illuminance }) => [time, illuminance]),
            } as SeriesLineOptions),
        );
        const data = history.map(({ timestamp, brightness }) => [
          timestamp - (timestamp % 1000),
          brightness,
        ]);
        const brightSeries: SeriesLineOptions = {
          id: 'brightness',
          name: 'Яркость',
          type: 'line',
          step: 'left',
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
          series: [brightSeries, ...series],
        };
      });
    });
  }, [open, latitude, longitude, isValidLocation]);
  React.useEffect(() => {
    if (!open) return;
    setOptions(opts => {
      const ts = Math.floor(Date.now() / 1000) * 1000;
      const brightnessSeries = opts.series?.find(({ id }) => id === 'brightness');
      if (brightnessSeries && brightnessSeries.type === 'line')
        brightnessSeries.data?.push([ts, currentBrightness]);
      return { ...opts };
    });
  }, [currentBrightness, open]);
  React.useEffect(() => {
    if (!open || !lastIlluminance) return;
    const [address, timestamp, value] = lastIlluminance.split(':');
    const id = `illuminance:${address}`;
    setOptions(opts => {
      const series = opts.series?.find(item => item.id === id);
      if (series && series.type === 'line') {
        series.data?.push([Number(timestamp), Number(value)]);
      }
      return { ...opts };
    });
  }, [lastIlluminance, open]);
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
