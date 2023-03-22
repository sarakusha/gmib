/* eslint-disable @typescript-eslint/no-explicit-any */
import { app } from 'electron';
import path from 'path';
import { promisify } from 'util';

import dayjs from 'dayjs';
import debugFactory from 'debug';
import log from 'electron-log';
import { Database } from 'sqlite3';

import type { NullableOptional } from '/@common/helpers';
import Deferred from '/@common/Deferred';

const nameCountRegexp = /(?:(?:-(\d+))?)?$/;
const nameCountFunc = (s: string, index: string): string => `-${(parseInt(index, 10) || 0) + 1}`;

export const incrementCounterString = (s: string): string =>
  s.replace(nameCountRegexp, nameCountFunc);

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:db`);

const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');
// eslint-disable-next-line @typescript-eslint/no-use-before-define
const db = new Database(dbPath, createTables);

db.exec('PRAGMA foreign_keys = ON');

const beginTransactionImpl = promisify(db.exec.bind(db, 'BEGIN TRANSACTION'));
const commitTransactionImpl = promisify(db.exec.bind(db, 'COMMIT'));
const asyncAll = promisify(db.all.bind(db));
const asyncRun = promisify(db.run.bind(db));
export const beginTransaction: () => Promise<true> = () => beginTransactionImpl().then(() => true);
export const commitTransaction: () => Promise<false> = () =>
  commitTransactionImpl().then(() => false);
export const rollback = promisify(db.exec.bind(db, 'ROLLBACK'));

const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

const dbDeferred = new Deferred();

export const dbReady = dbDeferred.promise;

export const formatDate = (date?: string): string => dayjs(date).format(DATETIME_FORMAT);

export const parseDate = (value?: string): string | undefined =>
  typeof value === 'undefined' ? undefined : dayjs(value, DATETIME_FORMAT).toISOString();

type ColumnDefinition = {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: null | string | number;
  pk: 0 | 1;
};

const checkColumnExists = async (
  table: string,
  column: string,
  definition: string,
): Promise<void> => {
  try {
    const columns = (await asyncAll(`PRAGMA table_info(${table})`)) as ColumnDefinition[];
    if (columns.findIndex(item => item.name === column) === -1) {
      debug(`ALTER TABLE ${table} ADD ${column} ${definition}`);
      await asyncRun(`ALTER TABLE ${table} ADD ${column} ${definition}`);
    }
  } catch (err) {
    debug(`error while check column: ${table}.${column}: ${err}`);
  }
};

function createTables(): void {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS telemetry (
            timestamp INT NOT NULL,
            address TEXT NOT NULL,
            x INT (2) NOT NULL,
            y INT (2) NOT NULL,
            temperature INT (1),
            PRIMARY KEY ( timestamp, address, x, y )
        )`,
      err => err && debug(`error while create telemetry ${err}`),
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS sensors (
            timestamp INT NOT NULL,
            address TEXT NOT NULL,
            illuminanse INT (2),
            tempearure INT (1),
            PRIMARY KEY ( timestamp, address )
        )`,
      err => err && debug(`error while create sensors ${err}`),
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS brightness (
                timestamp INT PRIMARY KEY NOT NULL,
                brightness INT(1) NOT NULL,
                actual INT (1)
          )`,
      err => err && debug(`error while create brightness ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS media (
            md5 TEXT PRIMARY KEY NOT NULL,
            filename TEXT NOT NULL,
            original_md5 TEXT NOT NULL,
            original TEXT NOT NULL,
            format_name TEXT,
            format_long_name TEXT,
            timecode INT,
            fps REAL,
            duration REAL NOT NULL,
            size REAL NOT NULL,
            streams INTEGER NOT NULL,
            video INT,
            audio INT,
            codec_name TEXT,
            codec_long_name TEXT,
            profile TEXT,
            width INT NOT NULL,
            height INT NOT NULL,
            field_order TEXT,
            upload_time TEXT,
            thumbnail TEXT
      )`,
      err => err && debug(`error while create media ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS playlist (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            flags INTEGER DEFAULT 0,
            creation_time TEXT,
            last_used TEXT
        )`,
      err => err && debug(`error while create playlist ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS playlistToMedia (
            id STRING(21) PRIMARY KEY NOT NULL,
            playlist_id INTEGER NOT NULL,
            media_md5 TEXT NOT NULL,
            flags INTEGER DEFAULT 0,
            start REAL,
            duration REAL,
            pos INTEGER NOT NULL,
--             PRIMARY KEY (playlist_id, pos),
            FOREIGN KEY (playlist_id)
                REFERENCES playlist (id) ON DELETE CASCADE,
            FOREIGN KEY (media_md5)
                REFERENCES media (md5) ON DELETE RESTRICT
        )`,
      err => err && debug(`error while create playlistToMedia ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS playerMapping (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          player INTEGER NOT NULL,
          display INTEGER,
          "left" INTEGER DEFAULT 0,
          top INTEGER DEFAULT 0,
          width INTEGER,
          height INTEGER,
          shader TEXT,
          zOrder INTEGER DEFAULT 0,
          flags INTEGER DEFAULT 0,
          FOREIGN KEY (player)
            REFERENCES player (id) ON DELETE CASCADE
        )`,
      err => err && debug(`error while create playerMapping: ${err}`),
    );
    // db.run(
    //   `CREATE TABLE IF NOT EXISTS videoOutput (
    //     id INTEGER PRIMARY KEY,
    //     name TEXT,
    //     minWidth INTEGER,
    //     minHeight INTEGER,
    //     "left" INTEGER,
    //     top INTEGER,
    //     display INTEGER,
    //     flags INTEGER DEFAULT 0
    //    )`,
    //   err => err && debug(`error while create videoOutput ${err}`),
    // );
    db.run(
      `CREATE TABLE IF NOT EXISTS screen (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            width INTEGER,
            height INTEGER,
            moduleWidth INTEGER,
            moduleHeight INTEGER,
            left INTEGER DEFAULT 0,
            top INTEGER DEFAULT 0,
            flags INTEGER DEFAULT 0,
            borderTop INTEGER DEFAULT 0,
            borderBottom INTEGER DEFAULT 0,
            borderLeft INTEGER DEFAULT 0,
            borderRight INTEGER DEFAULT 0,
            brightnessFactor REAL DEFAULT 1,
            test TEXT,
            display INTEGER,
            brightness INTEGER
        )`,
      err => err && debug(`error while create screen ${err}`),
    );
    checkColumnExists('screen', 'brightness', 'INTEGER default 60');
    db.run(
      `CREATE TABLE IF NOT EXISTS address (
            address TEXT NOT NULL,
            screenId INTEGER NOT NULL,
            FOREIGN KEY (screenId)
                REFERENCES screen (id) ON DELETE CASCADE
        )`,
      err => err && debug(`error while create address ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS isecret (
        id TEXT NOT NULL PRIMARY KEY,
        secret TEXT NOT NULL,
        created INTEGER NOT NULL
      )`,
      err => err && debug(`error while create isecret: ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS osecret (
        id TEXT NOT NULL PRIMARY KEY,
        secret TEXT NOT NULL
      )`,
      err => err && debug(`error while create isecret: ${err}`),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS player (
            id INTEGER PRIMARY KEY,
            "name" TEXT,
            playlistId INTEGER,
            "current" INTEGER DEFAULT 0,
            width INTEGER,
            height INTEGER,
            flags INTEGER DEFAULT 0,
            FOREIGN KEY (playlistId)
                REFERENCES playlist (id) ON DELETE SET NULL
        )`,
      err => {
        if (err) debug(`error while create player ${err}`);
        else
          setTimeout(() => {
            dbDeferred.resolve();
          }, 100);
      },
    );
    // db.run(
    //   `CREATE TABLE IF NOT EXISTS tile (
    //     id INTEGER PRIMARY KEY,
    //     name TEXT,
    //     player INTEGER NOT NULL,
    //     sWidth INTEGER NOT NULL,
    //     sHeight INTEGER NOT NULL,
    //     sx INTEGER NOT NULL,
    //     sy INTEGER NOT NULL,
    //     output INTEGER NOT NULL,
    //     dWidth INTEGER NOT NULL,
    //     dHeight INTEGER NOT NULL,
    //     dx INTEGER NOT NULL,
    //     dy INTEGER NOT NULL,
    //     FOREIGN KEY (player)
    //         REFERENCES player (id) ON DELETE CASCADE,
    //     FOREIGN KEY (output)
    //         REFERENCES videoOutput (id) ON DELETE CASCADE
    // )`,
    //   err => {
    //     if (err) debug(`error while create tile ${err}`);
    //     else
    //       setTimeout(() => {
    //         dbDeferred.resolve();
    //         debug('DB READY');
    //       }, 100);
    //   },
    // );

    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dt = date.getTime();
    db.run(
      `DELETE
             FROM telemetry
             WHERE timestamp < ?`,
      dt,
      err => {
        err && debug(`error while clear telemetry history, ${err.message}`);
      },
    );

    db.run(
      `DELETE
             FROM sensors
             WHERE timestamp < ?`,
      dt,
      err => {
        err && debug(`error while clear sensors history, ${err.message}`);
      },
    );

    db.run(
      `DELETE
             FROM brightness
             WHERE timestamp < ?`,
      dt,
      err => {
        err && debug(`error while clear brightness history, ${err.message}`);
      },
    );
  });
}

export function removeNull<T = any>(value: NullableOptional<T>): T {
  return Object.fromEntries(Object.entries(value).filter(([, val]) => val != null)) as unknown as T;
}

export const flag = (condition: boolean | undefined, value: number): number =>
  condition ? value : 0;

type Decoder<T> = (result: NullableOptional) => T;

const lazy = <F extends () => any>(creator: F): (() => ReturnType<F>) => {
  let res: ReturnType<F>;
  let processed = false;
  return () => {
    if (processed) return res;
    res = creator();
    processed = true;
    return res;
  };
};

export const promisifyGet = <P extends (...params: any) => any, R>(
  sql: string,
  encoder: P,
  decoder: Decoder<R>,
): ((...params: Parameters<P>) => Promise<R | undefined>) => {
  const fn = lazy(() => {
    const statement = db.prepare(sql);
    return promisify(statement.get.bind(statement));
  });
  return (...params) =>
    fn()(encoder(...(params as any))).then(
      result => (decoder ? result && decoder(result) : result) as R,
    );
};

export const promisifyAll = <P extends (...args: any) => any, R>(
  sql: string,
  encoder: P,
  decoder?: Decoder<R>,
): ((...params: Parameters<P>) => Promise<R[]>) => {
  const fn = lazy(() => {
    const statement = db.prepare(sql);
    return promisify(statement.all.bind(statement));
  });
  return (...params) =>
    fn()(encoder(params)).then(
      result => (decoder ? (result as NullableOptional).map(decoder) : result) as R[],
    );
};

export const promisifyRun = <P extends (...args: any) => any>(
  sql: string,
  encoder?: P,
): ((...params: Parameters<P>) => Promise<{ changes: number; lastID: number }>) => {
  const statement = lazy(() => db.prepare(sql));
  return (...params) =>
    new Promise((resolve, reject) => {
      statement().run(encoder ? encoder(...(params as any)) : params, function callback(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
};

export const uniqueField =
  <K extends string>(
    prop: K,
    exists: (value: string, id?: number) => Promise<boolean | undefined>,
  ) =>
  async <T extends Partial<Record<K, string | null>> & { id?: number }>(row: T): Promise<T> => {
    const { id, [prop]: original, ...other } = row;
    if (original == null) return row;
    let value: string = original;
    // eslint-disable-next-line no-await-in-loop
    while (await exists(value, id)) {
      value = incrementCounterString(value);
    }
    return { ...other, id, [prop]: value } as unknown as T;
  };

process.nextTick(() => log.log(`DB: ${dbPath}`));

export default db;
