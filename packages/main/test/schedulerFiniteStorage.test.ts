import { expect, it, vi } from 'vitest';
vi.mock('../src/db', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=OFF');
  const source = readFileSync(new URL('../src/db.ts', import.meta.url), 'utf8');
  const schema = source.match(/CREATE TABLE IF NOT EXISTS schedulerJob \([\s\S]*?\n      \)/)![0];
  db.exec(schema);
  const query =
    (method: string) =>
    (sql: string, encode: (...args: any[]) => any, decode = (v: any) => v) =>
    async (...args: any[]) => {
      const params = encode(...args);
      const statement = db.prepare(sql);
      const value = (statement as any)[method](...(Array.isArray(params) ? params : [params]));
      return method === 'all'
        ? value.map(decode)
        : method === 'get'
          ? value && decode(value)
          : value;
    };
  return {
    promisifyRun: query('run'),
    promisifyGet: query('get'),
    promisifyAll: query('all'),
    removeNull: (v: any) =>
      Object.fromEntries(Object.entries(v).filter(([, value]) => value !== null)),
  };
});
import {
  createStoredSchedulerJob,
  getStoredPlayerSchedulerJob,
  updateStoredSchedulerJob,
  updateStoredSchedulerJobResult,
  claimExpiredPlayerSchedulerJob,
} from '../src/schedulerStore';
import type { PlayerSchedulerJobInput } from '/@common/scheduler';
const input: PlayerSchedulerJobInput = {
  name: 'Finite',
  playerId: 1,
  playlistId: 2,
  kind: 'once',
  runAt: '2026-11-02T18:00:00Z',
  enabled: true,
  priority: 0,
  action: 'play-playlist-times',
  repeatCount: 3,
  completionAction: 'hide',
};
it('persists and updates finite playback parameters through actual SQLite', async () => {
  const job = await createStoredSchedulerJob('player', input);
  expect(await getStoredPlayerSchedulerJob(job.id)).toMatchObject({
    repeatCount: 3,
    completionAction: 'hide',
  });
  await updateStoredSchedulerJob('player', job.id, {
    ...input,
    repeatCount: 2,
    completionAction: 'stop',
  });
  expect(await getStoredPlayerSchedulerJob(job.id)).toMatchObject({
    repeatCount: 2,
    completionAction: 'stop',
  });
});
it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid repeat count %s',
  async repeatCount => {
    await expect(createStoredSchedulerJob('player', { ...input, repeatCount })).rejects.toThrow();
  },
);
it('rejects missing playlist and invalid completion action', async () => {
  await expect(
    createStoredSchedulerJob('player', { ...input, playlistId: undefined }),
  ).rejects.toThrow();
  await expect(
    createStoredSchedulerJob('player', { ...input, completionAction: 'invalid' as never }),
  ).rejects.toThrow();
});

it('persists, clears and atomically claims player task expiry', async () => {
  const expiry = {
    ...input,
    kind: 'cron' as const,
    expiresAt: '2026-11-14T14:00:00',
    stopOnExpiry: true,
  };
  const job = await createStoredSchedulerJob('player', expiry);
  expect(await getStoredPlayerSchedulerJob(job.id)).toMatchObject({
    expiresAt: expiry.expiresAt,
    stopOnExpiry: true,
  });
  expect(await claimExpiredPlayerSchedulerJob(job)).toBe(true);
  expect(await claimExpiredPlayerSchedulerJob(job)).toBe(false);
  await updateStoredSchedulerJob('player', job.id, {
    ...expiry,
    expiresAt: '',
    stopOnExpiry: false,
  });
  expect(await getStoredPlayerSchedulerJob(job.id)).toMatchObject({
    expiresAt: undefined,
    stopOnExpiry: false,
  });
});
it.each([
  { expiresAt: 'garbage' },
  { expiresAt: 123 },
  { expiresAt: '2026-11-14T14:00:00', stopOnExpiry: 'yes' },
  { stopOnExpiry: true },
])('rejects invalid expiry parameters %j', async parameters => {
  await expect(
    createStoredSchedulerJob('player', {
      ...input,
      kind: 'cron',
      ...parameters,
    } as PlayerSchedulerJobInput),
  ).rejects.toThrow();
});
it('rejects expiry on a single occurrence', async () => {
  await expect(
    createStoredSchedulerJob('player', { ...input, expiresAt: '2026-11-14T14:00:00' }),
  ).rejects.toThrow();
});
it('does not restore stale task parameters or enablement when a running action finishes', async () => {
  const job = await createStoredSchedulerJob('player', { ...input, kind: 'cron' });
  await updateStoredSchedulerJob('player', job.id, {
    ...input,
    kind: 'cron',
    name: 'Edited',
    enabled: false,
    expiresAt: '2026-11-14T14:00:00',
  });
  await updateStoredSchedulerJobResult('player', job, { enabled: true, lastStatus: 'success' });
  expect(await getStoredPlayerSchedulerJob(job.id)).toMatchObject({
    name: 'Edited',
    enabled: false,
    expiresAt: '2026-11-14T14:00:00',
    lastStatus: 'success',
  });
});
