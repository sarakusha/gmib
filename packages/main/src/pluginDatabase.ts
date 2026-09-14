import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Database } from 'sqlite3';
import type {
  PluginDatabase,
  PluginMigration,
  PluginSql,
  PluginSqlValue,
} from '/@common/pluginServices';

/** One queue per database, including complete transactions and shutdown. */
export async function openPluginDatabase(
  directory: string,
  name: string,
  migrations: PluginMigration[],
) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error('Недопустимое имя базы данных');
  if (
    !Array.isArray(migrations) ||
    migrations.some((item, index) => item.version !== index + 1 || typeof item.sql !== 'string')
  ) {
    throw new Error('Миграции должны иметь последовательные версии начиная с 1');
  }
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, `${name}.sqlite3`);
  const stat = await fs.lstat(filename).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return undefined;
  });
  if (stat && (!stat.isFile() || stat.isSymbolicLink()))
    throw new Error('Недопустимый файл базы данных');
  const db = await new Promise<Database>((resolve, reject) => {
    const connection = new Database(filename, error =>
      error ? reject(error) : resolve(connection),
    );
  });
  let queue: Promise<unknown> = Promise.resolve();
  let closing = false;
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    if (closing) return Promise.reject(new Error('База данных закрывается'));
    const next = queue.then(work);
    queue = next.catch(() => undefined);
    return next;
  };
  const values = (params: PluginSqlValue[] = []) =>
    params.map(value => (value instanceof Uint8Array ? Buffer.from(value) : value));
  const direct: PluginSql = {
    all: <T>(sql: string, params?: PluginSqlValue[]) =>
      new Promise<T[]>((resolve, reject) => {
        db.all(sql, values(params), (error, rows) =>
          error ? reject(error) : resolve(rows as T[]),
        );
      }),
    get: <T>(sql: string, params?: PluginSqlValue[]) =>
      new Promise<T | undefined>((resolve, reject) => {
        db.get(sql, values(params), (error, row) =>
          error ? reject(error) : resolve(row as T | undefined),
        );
      }),
    run: (sql, params) =>
      new Promise((resolve, reject) => {
        db.run(sql, values(params), function complete(error) {
          if (error) reject(error);
          else resolve({ changes: this.changes, lastID: this.lastID });
        });
      }),
  };
  const exec = (sql: string) =>
    new Promise<void>((resolve, reject) =>
      db.exec(sql, error => (error ? reject(error) : resolve())),
    );
  const closeNative = () =>
    new Promise<void>((resolve, reject) => db.close(error => (error ? reject(error) : resolve())));
  try {
    await exec(
      'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;',
    );
    await exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, hash TEXT NOT NULL)',
    );
    const applied = await direct.all<{ version: number; hash: string }>(
      'SELECT version, hash FROM schema_migrations ORDER BY version',
    );
    if (applied.length > migrations.length)
      throw new Error('База создана более новой версией плагина');
    for (const migration of migrations) {
      const hash = createHash('sha256').update(migration.sql).digest('hex');
      const old = applied.find(row => row.version === migration.version);
      if (old) {
        if (old.hash !== hash)
          throw new Error(`Изменена применённая миграция ${migration.version}`);
        continue;
      }
      await exec('BEGIN IMMEDIATE');
      try {
        await exec(migration.sql);
        await direct.run('INSERT INTO schema_migrations VALUES (?,?)', [migration.version, hash]);
        await exec('COMMIT');
      } catch (error) {
        await exec('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    await closeNative();
    throw error;
  }
  const api: PluginDatabase = {
    all: (sql, params) => enqueue(() => direct.all(sql, params)),
    get: (sql, params) => enqueue(() => direct.get(sql, params)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    transaction: work =>
      enqueue(async () => {
        await exec('BEGIN IMMEDIATE');
        let active = true;
        const guard = <T>(action: () => Promise<T>) =>
          active ? action() : Promise.reject(new Error('Транзакция завершена'));
        const tx: PluginSql = {
          all: (sql, params) => guard(() => direct.all(sql, params)),
          get: (sql, params) => guard(() => direct.get(sql, params)),
          run: (sql, params) => guard(() => direct.run(sql, params)),
        };
        try {
          const result = await work(tx);
          active = false;
          await exec('COMMIT');
          return result;
        } catch (error) {
          active = false;
          await exec('ROLLBACK');
          throw error;
        }
      }),
  };
  let closePromise: Promise<void> | undefined;
  return {
    api,
    close: () => {
      closing = true;
      closePromise ??= queue.then(closeNative);
      return closePromise;
    },
  };
}
