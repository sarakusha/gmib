/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable no-var */
import { makeStyles } from '@material-ui/core/styles';
/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { BrightnessHistory } from '@nibus/core/lib/ipc/events';
import { XAxisOptions, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, Typography } from '@material-ui/core';
import SunCalc from 'suncalc';
import Highcharts, { SeriesLineOptions } from '../components/Highcharts';
import { useSelector } from '../store';
import { selectLocation } from '../store/configSlice';
import { noop } from '../util/helpers';
import { getCurrentNibusSession } from '../util/nibus';

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
    zoomType: 'x',
    alignTicks: false,
    resetZoomButton: {
      position: {
        verticalAlign: 'bottom',
        y: 30,
      },
    },
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
  date = new Date()
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

const useStyles = makeStyles({
  table: {
    display: 'grid',
    gridTemplateColumns: '10ch 10ch',
  },
  suntimes: {
    display: 'flex',
    justifyContent: 'space-evenly',
    // '& div ~ div': {
    //   marginLeft: theme.spacing(4),
    // },
  },
});

const BrightnessHistoryDialog: React.FC<Props> = ({ open = false, onClose = noop }) => {
  const [options, setOptions] = useState<Highcharts.Options>(highchartsOptions);
  const { latitude, longitude } = useSelector(selectLocation) ?? {};
  const isValidLocation = latitude !== undefined && longitude !== undefined;
  useEffect(() => {
    if (!open) return;
    const session = getCurrentNibusSession();
    let history: BrightnessHistory[] = [];
    session
      .getBrightnessHistory()
      .then(
        value => {
          history = value;
        },
        err => console.error(`error while get brightness history`, err.message)
      )
      .finally(() => {
        setOptions(opts => {
          const series = opts.series?.filter(({ yAxis }) => yAxis !== 1) ?? [];
          const brightSeries: SeriesLineOptions = {
            name: 'Яркость',
            type: 'line',
            yAxis: 1,
            tooltip: { valueSuffix: '%' },
            data: history.map(({ timestamp, brightness }) => [
              timestamp - (timestamp % 1000),
              brightness,
            ]),
          };
          if (isValidLocation) {
            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const xAxis = opts.xAxis as XAxisOptions;
            const [yPlotBands, yPlotLines] = getBands(latitude!, longitude!, yesterday);
            const [plotBands, plotLines] = getBands(latitude!, longitude!, now);
            xAxis.plotBands = [...yPlotBands, ...plotBands];
            xAxis.plotLines = [...yPlotLines, ...plotLines];
          }
          return {
            ...opts,
            series: series.concat(brightSeries),
          };
        });
      });
  }, [open, latitude, longitude, isValidLocation]);
  const suntimes = isValidLocation
    ? SunCalc.getTimes(new Date(), latitude!, longitude!)
    : undefined;
  const classes = useStyles();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullScreen>
      <DialogContent>
        <HighchartsReact highcharts={Highcharts} options={options} />
        {suntimes && (
          <div className={classes.suntimes}>
            <div className={classes.table}>
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
            </div>
            <div className={classes.table}>
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
            </div>
          </div>
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
