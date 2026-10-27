import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Database } from 'sqlite3';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ root: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => mocks.root, on: vi.fn(), quit: vi.fn() },
}));
vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

let root: string;
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

it.each(['brightness', 'schedulerJob', 'open'])(
  'settles initialization and shutdown after %s failure',
  async failure => {
    vi.resetModules();
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-db-init-failure-'));
    mocks.root = failure === 'open' ? path.join(root, 'missing-directory') : root;
    if (failure !== 'open') {
      const seed = new Database(path.join(root, 'db.sqlite3'));
      await new Promise<void>((resolve, reject) =>
        seed.exec(`CREATE TABLE seed (id INTEGER); CREATE INDEX ${failure} ON seed(id)`, error =>
          error ? reject(error) : resolve(),
        ),
      );
      await new Promise<void>((resolve, reject) =>
        seed.close(error => (error ? reject(error) : resolve())),
      );
    }
    const {
      default: db,
      dbReady,
      promisifyRun,
      closeDatabase,
      onBeforeDatabaseClose,
    } = await import('../src/db');
    const close = vi.spyOn(db, 'close');
    const pendingWrite = promisifyRun('DELETE FROM brightness')();
    const expected = failure === 'open' ? /SQLITE_CANTOPEN/ : /already an index/;
    await expect(dbReady).rejects.toThrow(expected);
    await expect(pendingWrite).rejects.toThrow(expected);
    // A producer can also fail while flushing its final write after initialization failed.
    const producer = vi.fn(() => promisifyRun('DELETE FROM brightness')().then(() => undefined));
    onBeforeDatabaseClose(producer);
    await expect(closeDatabase()).rejects.toThrow();
    expect(producer).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(failure === 'open' ? 0 : 1);
    expect(closeDatabase()).toBe(closeDatabase());
  },
);
