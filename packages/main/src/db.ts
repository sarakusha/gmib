/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, type Event } from 'electron';
import path from 'path';
import { promisify } from 'util';

import dayjs from 'dayjs';
import debugFactory from 'debug';
import log from 'electron-log';
import { Database, type Statement } from 'sqlite3';

import type { NullableOptional } from '/@common/helpers';
import Deferred from '/@common/Deferred';

const nameCountRegexp = /(?:(?:-(\d+))?)?$/;
const nameCountFunc = (s: string, index: string): string => `-${(parseInt(index, 10) || 0) + 1}`;

export const incrementCounterString = (s: string): string =>
  s.replace(nameCountRegexp, nameCountFunc);

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:db`);

const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');

let openError: Error | undefined;
const db = new Database(dbPath, createTables);
const pendingOperations = new Set<Promise<unknown>>();

const beforeCloseCallbacks = new Set<() => void | Promise<void>>();

/** Stop producers and finish their current work before draining SQL statements. */
export const onBeforeDatabaseClose = (callback: () => void | Promise<void>): void => {
  beforeCloseCallbacks.add(callback);
};

let closePromise: Promise<void> | undefined;
let isQuitting = false;
let isClosed = false;

db.exec('PRAGMA foreign_keys = ON', error => {
  if (error) dbDeferred.reject(error);
});

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
// Observe startup failure even when no producer has requested the database yet.
void dbReady.catch(error => debug(`database initialization failed: ${error}`));

const finalizeStatement = (statement: Statement): Promise<void> =>
  new Promise(resolve => {
    statement.finalize(error => {
      if (error) debug(`error while finalize database statement: ${error.message}`);
      resolve();
    });
  });

const trackOperation = <T>(operation: Promise<T>): Promise<T> => {
  pendingOperations.add(operation);
  void operation.then(
    () => pendingOperations.delete(operation),
    () => pendingOperations.delete(operation),
  );
  return operation;
};

/**
 * Transactions must own a connection: async operations on the shared connection
 * could otherwise be committed or rolled back by an unrelated request.
 * Keep the connection alive in the shutdown drain through COMMIT/ROLLBACK and close.
 */
export const withIsolatedDatabaseTransaction = <T>(
  mode: 'DEFERRED' | 'IMMEDIATE',
  operation: (connection: Database) => Promise<T>,
): Promise<T> => {
  if (closePromise) return Promise.reject(new Error('Database is closing'));
  return trackOperation(
    (async () => {
      await dbReady;
      const connection = await new Promise<Database>((resolve, reject) => {
        const opened = new Database(dbPath, error => {
          if (error) reject(error);
          else resolve(opened);
        });
      });
      const exec = (sql: string): Promise<void> =>
        new Promise((resolve, reject) => {
          connection.exec(sql, error => (error ? reject(error) : resolve()));
        });
      let inTransaction = false;
      try {
        connection.configure('busyTimeout', 5000);
        await exec('PRAGMA foreign_keys = ON');
        await exec(`BEGIN ${mode} TRANSACTION`);
        inTransaction = true;
        const result = await operation(connection);
        await exec('COMMIT');
        inTransaction = false;
        return result;
      } finally {
        try {
          if (inTransaction) await exec('ROLLBACK');
        } finally {
          await new Promise<void>((resolve, reject) => {
            connection.close(error => (error ? reject(error) : resolve()));
          });
        }
      }
    })(),
  );
};

const useStatement = <T>(
  sql: string,
  operation: (statement: Statement) => Promise<T>,
): Promise<T> =>
  trackOperation(
    (async () => {
      // Startup producers may run before the database open callback creates the schema.
      await dbReady;
      const statement = await new Promise<Statement>((resolve, reject) => {
        const prepared = db.prepare(sql, error => {
          // A failed prepare never calls queued get/all/run callbacks. Reject here so
          // shutdown cannot wait forever for an operation that will never complete.
          if (error) reject(error);
          else resolve(prepared);
        });
      });
      try {
        return await operation(statement);
      } finally {
        await finalizeStatement(statement);
      }
    })(),
  );

const closeDatabaseImpl = async (): Promise<void> => {
  const results = await Promise.allSettled(
    [...beforeCloseCallbacks].map(async callback => callback()),
  );
  // Failed initialization or a producer must not prevent releasing the connection.
  results.push(...(await Promise.allSettled([dbReady])));
  while (pendingOperations.size > 0) {
    await Promise.allSettled([...pendingOperations]);
  }

  // sqlite3 does not invoke close callbacks when opening never succeeded.
  if (openError) throw openError;
  await new Promise<void>((resolve, reject) => {
    db.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
};

export const closeDatabase = (): Promise<void> => (closePromise ??= closeDatabaseImpl());

const quitHandler = (event: Event): void => {
  if (isClosed) return;
  event.preventDefault();
  // Other async shutdown handlers can call app.quit again before SQL work finishes.
  if (isQuitting) return;
  isQuitting = true;
  void closeDatabase()
    .catch(error => debug(`error while close database: ${error}`))
    .finally(() => {
      isClosed = true;
      app.quit();
    });
};

app.on('before-quit', quitHandler);

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

const ensurePlayerMappingZIndex = async (): Promise<void> => {
  await checkColumnExists('playerMapping', 'zIndex', 'INTEGER DEFAULT 0');

  try {
    const columns = (await asyncAll('PRAGMA table_info(playerMapping)')) as ColumnDefinition[];
    if (!columns.some(item => item.name === 'zOrder')) return;

    // zOrder was the former name. Preserve its last meaningful value and leave
    // one layer parameter in the schema, API and output-window URL.
    await asyncRun('UPDATE playerMapping SET zIndex = zOrder WHERE zIndex = 0 AND zOrder != 0');
    await asyncRun('ALTER TABLE playerMapping DROP COLUMN zOrder');
  } catch (err) {
    debug(`error while migrate playerMapping.zOrder to zIndex: ${err}`);
  }
};

const schemaError = (table: string, error: Error | null): void => {
  if (!error) return;
  debug(`error while create ${table}: ${error}`);
  dbDeferred.reject(error);
};

function createTables(error: Error | null): void {
  if (error) {
    openError = error;
    dbDeferred.reject(error);
    return;
  }
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
      err => schemaError('telemetry', err),
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS sensors (
            timestamp INT NOT NULL,
            address TEXT NOT NULL,
            illuminance INT (2),
            temperature INT (1),
            PRIMARY KEY ( timestamp, address )
        )`,
      err => schemaError('sensors', err),
    );
    /** Были опечатки в названиях полей в старых версиях БД */
    void checkColumnExists('sensors', 'temperature', 'INT (1)');
    void checkColumnExists('sensors', 'illuminance', 'INT (2)');
    db.run(
      `CREATE TABLE IF NOT EXISTS brightness (
                timestamp INT PRIMARY KEY NOT NULL,
                brightness INT(1) NOT NULL,
                actual INT (1)
          )`,
      err => schemaError('brightness', err),
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
      err => schemaError('media', err),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS playlist (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            flags INTEGER DEFAULT 0,
            creation_time TEXT,
            last_used TEXT
        )`,
      err => schemaError('playlist', err),
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
            FOREIGN KEY (playlist_id)
                REFERENCES playlist (id) ON DELETE CASCADE,
            FOREIGN KEY (media_md5)
                REFERENCES media (md5) ON DELETE RESTRICT
        )`,
      err => schemaError('playlistToMedia', err),
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
          objectFit TEXT DEFAULT 'cover',
          zIndex INTEGER DEFAULT 0,
          flags INTEGER DEFAULT 0,
          FOREIGN KEY (player)
            REFERENCES player (id) ON DELETE CASCADE
        )`,
      err => schemaError('playerMapping', err),
    );
    void checkColumnExists('playerMapping', 'objectFit', "TEXT DEFAULT 'cover'");
    void ensurePlayerMappingZIndex();
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
            zIndex INTEGER DEFAULT 0,
            brightness INTEGER
        )`,
      err => schemaError('screen', err),
    );
    void checkColumnExists('screen', 'brightness', 'INTEGER default 60');
    void checkColumnExists('screen', 'zIndex', 'INTEGER DEFAULT 0');
    db.run(
      `CREATE TABLE IF NOT EXISTS address (
            address TEXT NOT NULL,
            screenId INTEGER NOT NULL,
            FOREIGN KEY (screenId)
                REFERENCES screen (id) ON DELETE CASCADE
        )`,
      err => schemaError('address', err),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS isecret (
        id TEXT NOT NULL PRIMARY KEY,
        secret TEXT NOT NULL,
        created INTEGER NOT NULL
      )`,
      err => schemaError('isecret', err),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS osecret (
        id TEXT NOT NULL PRIMARY KEY,
        secret TEXT NOT NULL
      )`,
      err => schemaError('isecret', err),
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS page (
        id TEXT NOT NULL PRIMARY KEY,
        url TEXT,
        title TEXT NOT NULL UNIQUE,
        flags INTEGER DEFAULT 0,
        preload TEXT,
        userAgent TEXT
      )`,
      err => schemaError('pages', err),
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS player (
            id INTEGER PRIMARY KEY,
            "name" TEXT,
            playlistId INTEGER,
            "current" TEXT,
            width INTEGER,
            height INTEGER,
            flags INTEGER DEFAULT 0,
            FOREIGN KEY (playlistId)
                REFERENCES playlist (id) ON DELETE SET NULL
        )`,
      err => {
        schemaError('player', err);
      },
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS schedulerJob (
        id TEXT PRIMARY KEY NOT NULL,
        scope TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        runAt TEXT,
        cron TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        lastRunAt TEXT,
        lastRunKey TEXT,
        lastStatus TEXT,
        lastMessage TEXT,
        action TEXT NOT NULL,
        playerId INTEGER,
        playlistId INTEGER,
        itemNumber INTEGER,
        hideOutputOnStop INTEGER,
        outputAll INTEGER,
        screenId INTEGER,
        testId TEXT,
        brightness INTEGER,
        enabledValue INTEGER,
        FOREIGN KEY (playerId)
          REFERENCES player (id) ON DELETE CASCADE,
        FOREIGN KEY (playlistId)
          REFERENCES playlist (id) ON DELETE SET NULL,
        FOREIGN KEY (screenId)
          REFERENCES screen (id) ON DELETE CASCADE,
        FOREIGN KEY (testId)
          REFERENCES page (id) ON DELETE SET NULL
      )`,
      err => {
        if (err) schemaError('schedulerJob', err);
        else {
          void checkColumnExists('schedulerJob', 'priority', 'INTEGER NOT NULL DEFAULT 0').then(
            () => dbDeferred.resolve(),
          );
        }
      },
    );
    db.all('SELECT typeof(current) as current_type FROM player LIMIT 1', (err, rows) => {
      if (err) {
        dbDeferred.reject(err);
        return;
      }
      const [first] = rows;
      if (
        first &&
        typeof first === 'object' &&
        'current_type' in first &&
        first.current_type === 'integer'
      ) {
        db.run('ALTER TABLE player DROP current', err => {
          if (!err) {
            db.run('ALTER TABLE player ADD current TEXT');
          }
        });
      }
    });
  });
}

export function removeNull<T = unknown>(value: NullableOptional<T>): T {
  return Object.fromEntries(Object.entries(value).filter(([, val]) => val != null)) as unknown as T;
}

export const flag = (condition: boolean | undefined, value: number): number =>
  condition ? value : 0;

type Decoder<T> = (result: NullableOptional) => T;

export const promisifyGet = <P extends (...params: any[]) => any, R>(
  sql: string,
  encoder: P,
  decoder: Decoder<R>,
): ((...params: Parameters<P>) => Promise<R | undefined>) => {
  return (...params) => {
    return useStatement(sql, statement =>
      promisify(statement.get.bind(statement))(encoder(...params)),
    ).then(result => (decoder ? result && decoder(result) : result) as R);
  };
};

export const promisifyAll = <P extends (...args: any[]) => any, R>(
  sql: string,
  encoder: P,
  decoder?: Decoder<R>,
): ((...params: Parameters<P>) => Promise<R[]>) => {
  return (...params) => {
    return useStatement(sql, statement =>
      promisify(statement.all.bind(statement))(encoder(...params)),
    ).then(result => (decoder ? (result as NullableOptional).map(decoder) : result) as R[]);
  };
};

export const promisifyRun = <P extends (...args: any[]) => any>(
  sql: string,
  encoder?: P,
): ((...params: Parameters<P>) => Promise<{ changes: number; lastID: number }>) => {
  return (...params) => {
    return useStatement(
      sql,
      statement =>
        new Promise((resolve, reject) => {
          statement.run(encoder ? encoder(...params) : params, function callback(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
          });
        }),
    );
  };
};

export const uniqueField =
  <K extends string, I extends number | string>(
    prop: K,
    exists: (value: string, id?: I) => Promise<boolean | undefined>,
  ) =>
  async <T extends Partial<Record<K, string | null>> & { id?: I }>(row: T): Promise<T> => {
    const { id, [prop]: original, ...other } = row;
    if (original == null) return row;
    let value: string = original;

    while (await exists(value, id)) {
      value = incrementCounterString(value);
    }
    return { ...other, id, [prop]: value } as unknown as T;
  };

process.nextTick(() => log.log(`DB: ${dbPath}`));

export default db;
