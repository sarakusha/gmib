import fs from 'node:fs/promises';
import path from 'node:path';
import { Database } from 'sqlite3';
import { afterAll, expect, it, vi } from 'vitest';

const mocks = await vi.hoisted(async () => {
  const fsModule = await import('node:fs/promises');
  const osModule = await import('node:os');
  const pathModule = await import('node:path');
  const { EventEmitter: Emitter } = await import('node:events');
  return {
    root: await fsModule.mkdtemp(pathModule.join(osModule.tmpdir(), 'gmib-db-shutdown-')),
    events: new Emitter(),
    quit: vi.fn(),
  };
});
vi.mock('electron', () => ({
  app: { getPath: () => mocks.root, on: mocks.events.on.bind(mocks.events), quit: mocks.quit },
}));
vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));
import {
  closeDatabase,
  dbReady,
  onBeforeDatabaseClose,
  promisifyAll,
  promisifyGet,
  promisifyRun,
  withIsolatedDatabaseTransaction,
} from '../src/db';

// Mirror history cleanup at module initialization, before a new DB creates its tables.
const startupCleanup = Promise.all([
  promisifyRun('DELETE FROM brightness WHERE timestamp < ?')(0),
  promisifyRun('DELETE FROM sensors WHERE timestamp < ?')(0),
  promisifyGet(
    'SELECT COUNT(*) AS count FROM brightness',
    () => [],
    row => row.count,
  )(),
  promisifyAll('SELECT * FROM sensors', () => [])(),
]);

afterAll(async () => {
  await closeDatabase();
  await fs.rm(mocks.root, { recursive: true, force: true });
});

it('queues first-run history queries until the schema is ready', async () => {
  const [, , count, rows] = await startupCleanup;
  expect(count).toBe(0);
  expect(rows).toEqual([]);
});

it('rejects preparation and execution errors without blocking later shutdown', async () => {
  await expect(promisifyRun('DELETE FROM missing_table')()).rejects.toThrow('no such table');
  await expect(
    promisifyGet(
      'SELECT * FROM missing_table',
      () => [],
      row => row,
    )(),
  ).rejects.toThrow('no such table');
  await expect(promisifyAll('SELECT * FROM missing_table', () => [])()).rejects.toThrow(
    'no such table',
  );
  await expect(
    promisifyRun('INSERT INTO brightness (timestamp, brightness) VALUES (?, ?)')(null, 10),
  ).rejects.toThrow('NOT NULL constraint failed');
});

it('waits for producer shutdown and its final SQL write, even on repeated before-quit', async () => {
  await dbReady;
  await promisifyRun('CREATE TABLE shutdown_test (value TEXT)')();
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  let transactionEntered!: () => void;
  const entered = new Promise<void>(resolve => {
    transactionEntered = resolve;
  });
  const transaction = withIsolatedDatabaseTransaction('IMMEDIATE', async connection => {
    await new Promise<void>((resolve, reject) => {
      connection.run(
        'INSERT INTO shutdown_test(value) VALUES (?)',
        'isolated transaction',
        error => (error ? reject(error) : resolve()),
      );
    });
    transactionEntered();
    await pending;
  });
  await entered;
  const producer = vi.fn(async () => {
    await pending;
    await promisifyRun('INSERT INTO shutdown_test(value) VALUES (?)')('saved before close');
  });
  onBeforeDatabaseClose(producer);
  const first = { preventDefault: vi.fn() };
  const repeated = { preventDefault: vi.fn() };
  mocks.events.emit('before-quit', first);
  mocks.events.emit('before-quit', repeated);
  expect(first.preventDefault).toHaveBeenCalledOnce();
  expect(repeated.preventDefault).toHaveBeenCalledOnce();
  expect(producer).toHaveBeenCalledOnce();
  expect(mocks.quit).not.toHaveBeenCalled();
  release();
  await transaction;
  await closeDatabase();
  // Let the quit handler finish its catch/finally chain.
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(mocks.quit).toHaveBeenCalledOnce();
  const last = { preventDefault: vi.fn() };
  mocks.events.emit('before-quit', last);
  expect(last.preventDefault).not.toHaveBeenCalled();
  const reopened = new Database(path.join(mocks.root, 'db.sqlite3'));
  try {
    const rows = await new Promise((resolve, reject) =>
      reopened.all('SELECT value FROM shutdown_test ORDER BY rowid', (error, value) =>
        error ? reject(error) : resolve(value),
      ),
    );
    expect(rows).toEqual([{ value: 'isolated transaction' }, { value: 'saved before close' }]);
    await expect(
      withIsolatedDatabaseTransaction('DEFERRED', async () => undefined),
    ).rejects.toThrow('Database is closing');
  } finally {
    await new Promise<void>((resolve, reject) =>
      reopened.close(error => (error ? reject(error) : resolve())),
    );
  }
});
