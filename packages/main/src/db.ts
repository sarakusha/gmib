// noinspection SqlNoDataSourceInspection

import { app, ipcMain } from 'electron';
import path from 'path';

import type { NullableOptional, TelemetryOpts } from '/@common/helpers';
import { HOUR, notEmpty } from '/@common/helpers';

import type { BrightnessHistory } from '@nibus/core/lib/ipc/events';
import debugFactory from 'debug';
import log from 'electron-log';
import { Database } from 'sqlite3';

import config from './config';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:db`);

const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');
// eslint-disable-next-line @typescript-eslint/no-use-before-define
const db = new Database(dbPath, createTables);

export const insertBrightness = (value: number | undefined): void => {
  db.run(
    'INSERT INTO brightness (timestamp, brightness, actual) VALUES (?, ?, ?)',
    Date.now(),
    value,
    null,
  );
};

ipcMain.on('addTelemetry', (event, { timestamp, address, x, y, temperature }: TelemetryOpts) => {
  // debug(`telemetry: ${timestamp}, address = ${address}, x = ${x}, y = ${y}, t =
  // ${temperature}`);
  db.run(
    'INSERT INTO telemetry (timestamp, address, x, y, temperature) VALUES (?, ?, ?, ?, ?)',
    timestamp,
    address,
    x,
    y,
    temperature,
  );
});

const listen = (): void => {
  config.onDidChange('brightness', insertBrightness);
};

function createTables(): void {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS telemetry
      (
        timestamp
        INT
        NOT
        NULL,
        address
        TEXT
        NOT
        NULL,
        x
        INT
       (
        2
       ) NOT NULL,
        y INT
       (
         2
       ) NOT NULL,
        temperature INT
       (
         1
       ),
        PRIMARY KEY
       (
         timestamp,
         address,
         x,
         y
       ))`,
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS sensors
      (
        timestamp
        INT
        NOT
        NULL,
        address
        TEXT
        NOT
        NULL,
        illuminanse
        INT
       (
        2
       ),
        tempearure INT
       (
         1
       ),
        PRIMARY KEY
       (
         timestamp,
         address
       ))`,
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS brightness
      (
        timestamp
        INT
        PRIMARY
        KEY
        NOT
        NULL,
        brightness
        INT
       (
        1
       ) NOT NULL,
        actual INT
       (
         1
       ))`,
      listen,
    );

    const date = new Date();
    date.setDate(date.getDate() - 7);

    db.exec(
      `DELETE
       FROM telemetry
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear telemetry history, ${err.message}`);
      },
    );

    db.exec(
      `DELETE
       FROM sensors
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear sensors history, ${err.message}`);
      },
    );

    db.exec(
      `DELETE
       FROM brightness
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear brightness history, ${err.message}`);
      },
    );
  });
}

function removeNull<T>(value: NullableOptional<T>): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, val]) => val !== null),
  ) as unknown as T;
}

export const getBrightnessHistory = async (dt?: number): Promise<BrightnessHistory[]> => {
  const now = Date.now();
  const to = dt ? Math.min(now, dt + 24 * HOUR) : now;
  const from = to - 24 * HOUR;
  const [first, result, last] = await Promise.all([
    new Promise<BrightnessHistory | undefined>((resolve, reject) => {
      db.get(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp <= ?
         ORDER BY timestamp DESC`,
        from,
        (error, row?: NullableOptional<BrightnessHistory>) => {
          if (error) reject(error);
          else
            resolve(
              row &&
                removeNull({
                  ...row,
                  timestamp: from,
                }),
            );
        },
      );
    }),
    new Promise<BrightnessHistory[]>((resolve, reject) => {
      db.all(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp > ? AND timestamp < ?`,
        from,
        to,
        (error: unknown, rows: NullableOptional<BrightnessHistory>[]) => {
          if (error) reject(error);
          else resolve(rows.map(removeNull));
        },
      );
    }),
    new Promise<BrightnessHistory | undefined>((resolve, reject) => {
      db.get(
        `SELECT timestamp, brightness, actual
         FROM brightness
         WHERE timestamp >= ?
         ORDER BY timestamp ASC`,
        to,
        (error, row?: NullableOptional<BrightnessHistory>) => {
          if (error) reject(error);
          else
            resolve(
              row &&
                removeNull({
                  ...row,
                  timestamp: to,
                }),
            );
        },
      );
    }),
  ]);
  return [first, ...result, last].filter(notEmpty);
};

process.nextTick(() => log.log(`DB: ${dbPath}`));
