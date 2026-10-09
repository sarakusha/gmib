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
import { closeDatabase, dbReady, onBeforeDatabaseClose, promisifyRun } from '../src/db';

afterAll(async () => {
  await closeDatabase();
  await fs.rm(mocks.root, { recursive: true, force: true });
});

it('waits for producer shutdown and its final SQL write, even on repeated before-quit', async () => {
  await dbReady;
  await promisifyRun('CREATE TABLE shutdown_test (value TEXT)')();
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
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
  await closeDatabase();
  // Let the quit handler finish its catch/finally chain.
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(mocks.quit).toHaveBeenCalledOnce();
  const last = { preventDefault: vi.fn() };
  mocks.events.emit('before-quit', last);
  expect(last.preventDefault).not.toHaveBeenCalled();
  const reopened = new Database(path.join(mocks.root, 'db.sqlite3'));
  try {
    const row = await new Promise((resolve, reject) =>
      reopened.get('SELECT value FROM shutdown_test', (error, value) =>
        error ? reject(error) : resolve(value),
      ),
    );
    expect(row).toEqual({ value: 'saved before close' });
  } finally {
    await new Promise<void>((resolve, reject) =>
      reopened.close(error => (error ? reject(error) : resolve())),
    );
  }
});
