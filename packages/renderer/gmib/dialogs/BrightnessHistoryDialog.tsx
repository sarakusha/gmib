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
import sortBy from 'lodash/sortBy';
import React, { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

import Highcharts from '../components/Highcharts';
import { useSelector } from '../store';

import type { SensorsData } from '/@common/helpers';
import { noop, notEmpty } from '/@common/helpers';
import { host, isRemoteSession, port } from '/@common/remote';

import {
  selectBrightness,
  selectIlluminance,
  selectLastWithAddress,
  selectLocation,
  selectSpline,
} from '../store/selectors';
import type { Point } from '../util/MonotonicCubicSpline';
import MonotonicCubicSpline from '../util/MonotonicCubicSpline';
import { createSelector } from '@reduxjs/toolkit';
import type { Config, SplineItem } from '/@common/config';
import { series } from '@novastar/codec';

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

const DAY = 1000 * 60 * 60 * 24;

const deviation = (value: number, max = 0.1): number => (2 * Math.random() - 1) * max * value;

const MOSCOW_LAT = 55.7522;
const MOSCOW_LON = 37.6156;

const getFakeSensors = ({
  latitude = MOSCOW_LAT,
  longitude = MOSCOW_LON,
}: Config['location'] = {}): SeriesLineOptions => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { dawn, sunriseEnd, goldenHourEnd, solarNoon, goldenHour, sunsetStart, dusk } =
    SunCalc.getTimes(now, latitude, longitude);

  const getTime = (date: Date): number => Math.abs(date.getTime() - midnight.getTime()) % DAY;
  const before = new MonotonicCubicSpline([
    [getTime(dawn), 4],
    [getTime(sunriseEnd), 750],
    [getTime(goldenHourEnd), 8000],
    [getTime(solarNoon), 15000],
  ]);
  const after = new MonotonicCubicSpline([
    [getTime(solarNoon), 15000],
    [getTime(goldenHour), 8000],
    [getTime(sunsetStart), 750],
    [getTime(dusk), 4],
  ]);

  const solarNoonTime = getTime(solarNoon);
  const dawnTime = getTime(dawn);
  const duskTime = getTime(dusk);

  let r = 0;

  const getFakeIlluminance = (date: Date): number => {
    const dateTime = getTime(date);
    if (dateTime < dawnTime || dateTime > duskTime) return 4;
    const result =
      dateTime < solarNoonTime ? before.interpolate(dateTime) : after.interpolate(dateTime);
    if (date.getMinutes() % 30 === 0) {
      r = deviation(result, 0.2);
    }
    return Math.round(r + deviation(result, 0.1) + result);
  };
  const data: SeriesLineOptions['data'] = [];
  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setMinutes(0);
  from.setSeconds(0);
  from.setMilliseconds(0);
  for (let date = from; date <= now; date.setMinutes(date.getMinutes() + 3)) {
    data.push([date.getTime(), getFakeIlluminance(date)]);
  }
  const address = '0.0.1';
  return {
    id: `illuminance:${address}`,
    name: `Освещенность ${address}`,
    yAxis: 0,
    type: 'line',
    tooltip: { valueSuffix: ' lux' },
    color: '#FF8000',
    shadow: true,
    data,
  };
};

const selectFakeSensors = createSelector(selectLocation, getFakeSensors);
const minSpline: SplineItem = [10, 20];
const maxSpline: SplineItem = [10000, 100];

const selectFakeBrightness = createSelector(
  [selectFakeSensors, selectSpline],
  (illuminanceSeries, spline = [minSpline, maxSpline]) => {
    const safeData = sortBy(spline.filter(notEmpty), ([lux]) => lux);
    const [min] = safeData;
    const max = safeData.length > 1 ? safeData[safeData.length - 1] : maxSpline;
    const [minLux, minBrightness] = min;
    const [maxLux, maxBrightness] = max;
    const illuminanceSpline = new MonotonicCubicSpline(
      safeData.map(([lux, bright]) => [Math.log(1 + lux), bright]),
    );
    const calcBrightness = (illuminance: number): number => {
      if (illuminance <= minLux) return minBrightness;
      if (illuminance >= maxLux) return maxBrightness;
      return Math.round(illuminanceSpline.interpolate(Math.log(1 + illuminance)));
    };
    const toBrightness = ([time, illuminance]: Point): Point => [time, calcBrightness(illuminance)];
    const brightSeries: SeriesLineOptions = {
      id: 'brightness',
      name: 'Яркость',
      type: 'line',
      step: 'left',
      yAxis: 1,
      tooltip: { valueSuffix: '%' },
      data: (illuminanceSeries?.data as Point[])?.map(toBrightness),
    };
    return brightSeries;
  },
);

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

const selectXAxis = createSelector(
  [selectLocation, selectFakeSensors],
  (location, illuminanceSeries) => {
    const { latitude = MOSCOW_LAT, longitude = MOSCOW_LON } = location ?? {};
    const xAxis: XAxisOptions = {type: 'datetime'};
    const data = (illuminanceSeries?.data as Point[]) ?? [];
    const [from] = data;
    const to = data.at(-1);
    const [yPlotBands, yPlotLines] = getBands(latitude, longitude, new Date(from[0]));
    const [plotBands, plotLines] = getBands(latitude, longitude, to ? new Date(to[0]) : new Date());
    xAxis.plotBands = [...yPlotBands, ...plotBands];
    xAxis.plotLines = [...yPlotLines, ...plotLines];
    return xAxis;
  },
);

const selectOptions = createSelector(
  [selectFakeSensors, selectFakeBrightness, selectXAxis],
  (illuminanceSeries, brightnessSeries, xAxis): Highcharts.Options => ({
    ...highchartsOptions,
    series: [brightnessSeries, illuminanceSeries],
    xAxis,
  }),
);

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 10ch 10ch;
`;

const BrightnessHistoryDialog: React.FC<Props> = ({ open = false, onClose = noop }) => {
  const { latitude = MOSCOW_LAT, longitude = MOSCOW_LON } = useSelector(selectLocation) ?? {};
  const isValidLocation = latitude !== undefined && longitude !== undefined;
  const options = useSelector(selectOptions);
  const suntimes = isValidLocation ? SunCalc.getTimes(new Date(), latitude, longitude) : undefined;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullScreen>
      <DialogContent>
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
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
