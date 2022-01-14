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
import semverLt from 'semver/functions/lt';

import { HOUR, notEmpty, NullableOptional } from '../util/helpers';
import config, { prevVersion } from './config';
import debugFactory, { log } from '../util/debug';

const debug = debugFactory('gmib:db');

let db: Database;

export const insertBrightness = (value: number): void => {
  db.run(
    'INSERT INTO brightness (timestamp, brightness, actual) VALUES (?, ?, ?)',
    Date.now(),
    value,
    null
  );
};

ipcMain.on(
  'addTelemetry',
  (event, timestamp: number, address: string, x: number, y: number, temperature: number) => {
    // debug(`telemetry: ${timestamp}, address = ${address}, x = ${x}, y = ${y}, t =
    // ${temperature}`);
    db.run(
      'INSERT INTO telemetry (timestamp, address, x, y, temperature) VALUES (?, ?, ?, ?, ?)',
      timestamp,
      address,
      x,
      y,
      temperature
    );
  }
);

const listen = (): void => {
  config.onDidChange('brightness', insertBrightness);
};

const createTables = (): void => {
  db.serialize(() => {
    if (prevVersion && semverLt(prevVersion, '3.2.5')) {
      debug(`drop old tables: telemetry, sensors`);
      db.run(`DROP TABLE IF EXISTS telemetry`);
      db.run(`DROP TABLE IF EXISTS sensors`);
    }
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
       ))`
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
       ))`
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
      listen
    );

    const date = new Date();
    date.setDate(date.getDate() - 7);

    db.exec(
      `DELETE
       FROM telemetry
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear telemetry history, ${err.message}`);
      }
    );

    db.exec(
      `DELETE
       FROM sensors
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear sensors history, ${err.message}`);
      }
    );

    db.exec(
      `DELETE
       FROM brightness
       WHERE timestamp < ${date.getTime()}`,
      err => {
        err && debug(`error while clear brightness history, ${err.message}`);
      }
    );
  });
};

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
                })
            );
        }
      );
    }),
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
                })
            );
        }
      );
    }),
  ]);
  return [first, ...result, last].filter(notEmpty);
};

const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');
db = new Database(dbPath, createTables);
process.nextTick(() => log.log(`DB: ${dbPath}`));
