import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Database } from 'sqlite3';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ root: '' }));
vi.mock('electron', () => ({ app: { getPath: () => mocks.root, on: vi.fn(), quit: vi.fn() } }));
vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

it('migrates an existing scheduler table before dbReady and preserves legacy tasks', async () => {
  mocks.root = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-scheduler-expiry-'));
  const seed = new Database(path.join(mocks.root, 'db.sqlite3'));
  const source = await fs.readFile(new URL('../src/db.ts', import.meta.url), 'utf8');
  const legacySchema = source
    .match(/CREATE TABLE IF NOT EXISTS schedulerJob \([\s\S]*?\n      \)/)![0]
    .replace(/\s+expiresAt TEXT,/, '')
    .replace(/\s+stopOnExpiry INTEGER,/, '');
  const exec = (db: Database, sql: string) =>
    new Promise<void>((resolve, reject) => {
      db.exec(sql, error => (error ? reject(error) : resolve()));
    });
  await exec(seed, legacySchema);
  await exec(
    seed,
    `INSERT INTO schedulerJob (id, scope, kind, name, enabled, priority, action)
    VALUES ('legacy', 'player', 'cron', 'Existing task', 1, 0, 'play')`,
  );
  await new Promise<void>((resolve, reject) =>
    seed.close(error => (error ? reject(error) : resolve())),
  );
  const { dbReady, default: db, closeDatabase } = await import('../src/db');
  try {
    await dbReady;
    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      db.all('SELECT * FROM schedulerJob', (error, values) =>
        error ? reject(error) : resolve(values as Record<string, unknown>[]),
      );
    });
    expect(rows).toEqual([
      expect.objectContaining({ id: 'legacy', enabled: 1, expiresAt: null, stopOnExpiry: null }),
    ]);
    await exec(
      db,
      `UPDATE schedulerJob SET expiresAt = '2026-11-14T14:00:00', stopOnExpiry = 1 WHERE id = 'legacy'`,
    );
  } finally {
    await closeDatabase();
    await fs.rm(mocks.root, { recursive: true, force: true });
  }
});
