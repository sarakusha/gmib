import { ipcMain } from 'electron';

import type { BrightnessHistory } from '@nibus/core/ipc/events';

import config from './config';
import { promisifyAll, promisifyGet, promisifyRun, removeNull } from './db';

import type { NullableOptional, TelemetryOpts } from '/@common/helpers';
import { HOUR, notEmpty } from '/@common/helpers';

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

config.onDidChange('brightness', brightness => {
  if (brightness !== undefined) insertBrightness(brightness);
});

ipcMain.on('addTelemetry', (event, params: TelemetryOpts) => insertTelemetry(params));
