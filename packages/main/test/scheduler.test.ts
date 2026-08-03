import { describe, expect, it } from 'vitest';

import {
  cronToString,
  defaultCron,
  getNextRunAt,
  matchesCron,
  normalizeCronSchedule,
} from '../../common/scheduler';
import { compareSchedulerOrder, type SchedulerOrderItem } from '../src/schedulerOrder';
import { enqueueSchedulerJob } from '../src/schedulerQueue';

describe('scheduler cron seconds', () => {
  it('matches and formats seconds as the first cron part', () => {
    const cron = defaultCron();
    cron.seconds = { mode: 'select', every: 1, selected: [5, 20] };
    cron.minutes = { mode: 'all', every: 1, selected: [] };

    expect(cronToString(cron)).toBe('5,20 * * * * *');
    expect(matchesCron(cron, new Date(2026, 7, 3, 12, 1, 20))).toBe(true);
    expect(matchesCron(cron, new Date(2026, 7, 3, 12, 1, 21))).toBe(false);
  });

  it('keeps legacy five-part schedules on the zero second', () => {
    const { seconds: _seconds, ...legacyCron } = defaultCron();
    const cron = normalizeCronSchedule(legacyCron);

    expect(cron.seconds).toEqual({ mode: 'select', every: 1, selected: [0] });
  });

  it('finds the next run within the current minute', () => {
    const cron = defaultCron();
    cron.seconds = { mode: 'every', every: 10, selected: [] };
    cron.minutes = { mode: 'all', every: 1, selected: [] };

    expect(
      getNextRunAt(
        {
          id: 'job',
          kind: 'cron',
          name: 'Job',
          cron,
          enabled: true,
          priority: 0,
        },
        new Date(2026, 7, 3, 12, 1, 23, 500),
      ),
    ).toBe(new Date(2026, 7, 3, 12, 1, 30).toISOString());
  });
});

describe('scheduler priority order', () => {
  it('orders simultaneous GMIB and player jobs by descending priority', () => {
    const items: SchedulerOrderItem[] = [
      { scope: 'player', scheduledAt: 1000, job: { id: 'player-2', priority: 20 } },
      { scope: 'gmib', scheduledAt: 1000, job: { id: 'gmib-2', priority: 10 } },
      { scope: 'player', scheduledAt: 1000, job: { id: 'player-1', priority: 30 } },
      { scope: 'gmib', scheduledAt: 1000, job: { id: 'gmib-1', priority: 40 } },
    ];

    expect(items.sort(compareSchedulerOrder).map(item => item.job.id)).toEqual([
      'gmib-1',
      'player-1',
      'player-2',
      'gmib-2',
    ]);
  });

  it('does not let priority overtake an earlier scheduled time', () => {
    const items: SchedulerOrderItem[] = [
      { scope: 'gmib', scheduledAt: 2000, job: { id: 'later', priority: 100 } },
      { scope: 'player', scheduledAt: 1000, job: { id: 'earlier', priority: -100 } },
    ];

    expect(items.sort(compareSchedulerOrder).map(item => item.job.id)).toEqual([
      'earlier',
      'later',
    ]);
  });
});

describe('scheduler queue', () => {
  it('runs jobs sequentially across scheduler scopes', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const gmib = enqueueSchedulerJob(async () => {
      order.push('gmib:start');
      await firstFinished;
      order.push('gmib:end');
    });
    const player = enqueueSchedulerJob(async () => {
      order.push('player:start');
      order.push('player:end');
    });

    await Promise.resolve();
    expect(order).toEqual(['gmib:start']);
    releaseFirst();
    await Promise.all([gmib, player]);
    expect(order).toEqual(['gmib:start', 'gmib:end', 'player:start', 'player:end']);
  });
});
