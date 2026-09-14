import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openPluginDatabase } from '../src/pluginDatabase';
const migrations = [
  {
    version: 1,
    sql: 'CREATE TABLE counter(id INTEGER PRIMARY KEY, value INTEGER NOT NULL); INSERT INTO counter VALUES (1, 0);',
  },
];

describe('plugin SQLite', () => {
  it('serializes transactions, rolls back failures, persists and checks migrations', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'gmib-plugin-db-'));
    let database: Awaited<ReturnType<typeof openPluginDatabase>> | undefined;
    try {
      database = await openPluginDatabase(dir, 'test', migrations);
      const { api } = database;
      await Promise.all(
        Array.from({ length: 12 }, () =>
          api.transaction(async tx => {
            const row = await tx.get<{ value: number }>('SELECT value FROM counter WHERE id=1');
            await tx.run('UPDATE counter SET value=? WHERE id=1', [row!.value + 1]);
          }),
        ),
      );
      expect(await api.get('SELECT value FROM counter')).toEqual({ value: 12 });
      await expect(
        api.transaction(async tx => {
          await tx.run('UPDATE counter SET value=99');
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(await api.get('SELECT value FROM counter')).toEqual({ value: 12 });
      await database.close();
      await expect(api.get('SELECT 1')).rejects.toThrow(/закрывается/);
      database = await openPluginDatabase(dir, 'test', migrations);
      expect(await database.api.get('SELECT value FROM counter')).toEqual({ value: 12 });
      await database.close();
      await expect(
        openPluginDatabase(dir, 'test', [{ version: 1, sql: 'SELECT 1' }]),
      ).rejects.toThrow(/миграция/);
      await expect(openPluginDatabase(dir, '../escape', migrations)).rejects.toThrow(/имя/);
      await expect(openPluginDatabase(dir, 'test', [])).rejects.toThrow(/новой/);
    } finally {
      await database?.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
