import { ipcMain } from 'electron';

import debugFactory from 'debug';
import type { BrightnessHistory } from '@nibus/core/ipc/events';

import config from './config';
import { promisifyAll, promisifyGet, promisifyRun, removeNull } from './db';

import type { NullableOptional, SensorsData, TelemetryOpts } from '/@common/helpers';
import { HOUR, notEmpty } from '/@common/helpers';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:history`);

const toBrightnessHistory = (result: NullableOptional): BrightnessHistory => {
  const { timestamp, brightness, actual } = removeNull(result);
  return { timestamp, brightness, actual };
};

const insertBrightness = promisifyRun(
  `INSERT INTO brightness (timestamp, brightness)
   VALUES ($now, $brightness)`,
  (brightness: number) => ({ $brightness: brightness, $now: Date.now() }),
);

const insertTelemetry = promisifyRun(
  `INSERT INTO telemetry (timestamp, address, x, y, temperature)
   VALUES ($timestamp, $address, $x, $y, $temperature)`,
  (params: TelemetryOpts) => ({
    $timestamp: params.timestamp,
    $address: params.address,
    $x: params.x,
    $y: params.y,
    $temperature: params.temperature,
  }),
);

const deleteTelemetry = promisifyRun(
  `DELETE
    FROM telemetry
    WHERE timestamp < ?`,
  (before: number) => before,
);

const getBrightnessHistoryFirst = promisifyGet(
  `SELECT timestamp, brightness, actual
   FROM brightness
   WHERE timestamp <= ?
   ORDER BY timestamp DESC
   LIMIT 1`,
  (before: number) => before,
  toBrightnessHistory,
);

const getBrightnessHistory = promisifyAll(
  `SELECT timestamp, brightness, actual
   FROM brightness
   WHERE timestamp > ?
     AND timestamp < ?`,
  (from: number, to: number) => [from, to],
  toBrightnessHistory,
);

const getBrightnessHistoryLast = promisifyGet(
  `SELECT timestamp, brightness, actual
   FROM brightness
   WHERE timestamp >= ?
   ORDER BY timestamp
   LIMIT 1`,
  (after: number) => after,
  toBrightnessHistory,
);

// eslint-disable-next-line import/prefer-default-export
export const getBrightnessHistoryOn = async (dt: number): Promise<BrightnessHistory[]> => {
  const now = Date.now();
  const to = dt ? Math.min(now, dt + 24 * HOUR) : now;
  const from = to - 24 * HOUR;
  const [first, history, last] = await Promise.all([
    getBrightnessHistoryFirst(from),
    getBrightnessHistory(from, to),
    getBrightnessHistoryLast(to),
  ]);
  return [first, ...history, last].filter(notEmpty);
};

const deleteBrightness = promisifyRun(
  'DELETE FROM brightness WHERE timestamp < ?',
  (before: number) => before,
);

const insertSensor = promisifyRun(
  `INSERT INTO sensors (timestamp, address, illuminance, temperature)
  VALUES ($timestamp, $address, $illuminance, $temperature)`,
  ({ address, temperature, illuminance }: SensorsData) => ({
    $timestamp: Date.now(),
    $address: address,
    $temperature: temperature,
    $illuminance: illuminance,
  }),
);

const deleteSensors = promisifyRun(
  'DELETE FROM sensors WHERE timestamp < ?',
  (before: number) => before,
);

export const getSensors = promisifyAll(
  `SELECT
    address,
    round(AVG(temperature)) as temperature,
    round(AVG(illuminance)) as illuminance,
    round(timestamp/$scale)*$scale as time
  FROM sensors
  WHERE timestamp >= $after
  GROUP BY address, time`,
  (after: number, scale = 1000 * 60 * 5) => ({ $after: after, $scale: scale }),
);

ipcMain.on('sensors', (_, data: SensorsData) => {
  insertSensor(data).catch(err => {
    debug(`error while save sensor: ${(err as Error).message}`);
  });
});

config.onDidChange('brightness', brightness => {
  if (brightness !== undefined) insertBrightness(brightness);
});

ipcMain.on('addTelemetry', (_, params: TelemetryOpts) => insertTelemetry(params));

const removeOutdated = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const before = date.getTime();
  deleteBrightness(before).catch(err =>
    debug(`error while clear brightness history: ${(err as Error).message}`),
  );
  deleteTelemetry(before).catch(err =>
    debug(`error while clear telemetry history: ${(err as Error).message}`),
  );
  deleteSensors(before).catch(err =>
    debug(`error while clear sensors history: ${(err as Error).message}`),
  );
  setTimeout(removeOutdated, 1000 * 60 * 60 * 24);
};

removeOutdated();
