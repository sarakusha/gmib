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
import { Database } from 'sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';
import { notEmpty, NullableOptional } from '../util/helpers';
import config from './config';
import { log } from '../util/debug';

let db: Database;

let actualBrightness: number | null = null;

export const insertBrightness = (value: number): void => {
  db.run(
    'INSERT INTO brightness (timestamp, brightness, actual) VALUES (?, ?, ?)',
    Date.now(),
    value,
    actualBrightness
  );
};

type SaveTemperature = (temperature: number, x: number, y: number, device?: number) => void;

let currentTemperatureSaver: SaveTemperature = () => {};

export const startTelemetry = (): SaveTemperature => {
  const timestamp = Date.now();
  return (temperature, x, y, device = 0): void => {
    db.run(
      'INSERT INTO temperatures (timestamp, device, x, y, temperature) VALUES (? ? ? ? ?)',
      timestamp,
      device,
      x,
      y,
      temperature
    );
  };
};

const start = (): void => {
  config.onDidChange('brightness', insertBrightness);
};

const createTables = (): void => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS telemetry (
                timestamp INT NOT NULL,
                device INT(1) NOT NULL,
                x INT(2) NOT NULL,
                y INT(2) NOT NULL,
                temperature INT(1))`);
    db.run(
      `CREATE TABLE IF NOT EXISTS brightness (
           timestamp INT PRIMARY KEY NOT NULL,
           brightness INT(1) NOT NULL,
           actual INT(1))`,
      start
    );
  });
};

ipcMain.on('actualBrightness', (event, value: number | null) => {
  actualBrightness = value;
  insertBrightness(config.get('brightness'));
});

ipcMain.on('startTelemetry', () => {
  currentTemperatureSaver = startTelemetry();
});

ipcMain.on('telemetry', (event, temperature: number, x: number, y: number, device = 0): void =>
  currentTemperatureSaver(temperature, x, y, device)
);

const HOUR = 60 * 60 * 1000;

function removeNull<T>(value: NullableOptional<T>): T {
  return (Object.fromEntries(
    Object.entries(value).filter(([, val]) => val !== null)
  ) as unknown) as T;
}

export const getBrightnessHistory = async (dt?: number): Promise<BrightnessHistory[]> => {
  const now = Date.now();
  const to = dt ? Math.min(now, dt + 24 * HOUR) : now;
  const from = to - 24 * HOUR;
  const [first, result, last] = await Promise.all([
    new Promise<BrightnessHistory | undefined>((resolve, reject) =>
      db.get(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp <= ?
         ORDER BY timestamp DESC`,
        from,
        (error, row?: NullableOptional<BrightnessHistory>) => {
          if (error) reject(error);
          else resolve(row && removeNull({ ...row, timestamp: from }));
        }
      )
    ),
    new Promise<BrightnessHistory[]>((resolve, reject) => {
      db.all(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp > ? AND timestamp < ?`,
        from,
        to,
        (error, rows: NullableOptional<BrightnessHistory>[]) => {
          if (error) reject(error);
          else resolve(rows.map(removeNull));
        }
      );
    }),
    new Promise<BrightnessHistory | undefined>((resolve, reject) =>
      db.get(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp >= ?
         ORDER BY timestamp ASC`,
        to,
        (error, row?: NullableOptional<BrightnessHistory>) => {
          if (error) reject(error);
          else resolve(row && removeNull({ ...row, timestamp: to }));
        }
      )
    ),
  ]);
  return [first, ...result, last].filter(notEmpty);
};

const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');
db = new Database(dbPath, createTables);
process.nextTick(() => log.log(`DB: ${dbPath}`));

const date = new Date();
date.setDate(date.getDate() - 7);

db.exec(`DELETE FROM telemetry WHERE timestamp < ${date.getTime()}`, err => {
  err && log.error(`error while clear telemetry db, ${err.message}`);
});

db.exec(`DELETE FROM brightness WHERE timestamp < ${date.getTime()}`, err => {
  err && log.error(`error while clear brightness db, ${err.message}`);
});
