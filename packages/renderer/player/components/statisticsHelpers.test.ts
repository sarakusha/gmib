import { describe, expect, it } from 'vitest';

import type { PlaybackStatistics } from '/@common/playbackStatistics';

import {
  formatDuration,
  isValidRange,
  MIN_STATISTICS_BAR_WIDTH,
  presetRange,
  statisticsCsv,
} from './statisticsHelpers';

describe('playback statistics presentation', () => {
  it('uses the host calendar across month and year boundaries', () => {
    expect(presetRange('today', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' });
    expect(presetRange('yesterday', '2026-01-01')).toEqual({
      from: '2025-12-31',
      to: '2025-12-31',
    });
    expect(presetRange('week', '2026-01-01')).toEqual({ from: '2025-12-26', to: '2026-01-01' });
  });

  it('rejects invalid and reversed custom dates', () => {
    expect(isValidRange({ from: '2026-02-28', to: '2026-03-01' })).toBe(true);
    expect(isValidRange({ from: '2026-02-31', to: '2026-03-01' })).toBe(false);
    expect(isValidRange({ from: '2026-03-02', to: '2026-03-01' })).toBe(false);
  });

  it('shows seconds for short clips and longer totals', () => {
    expect(formatDuration(5_900)).toBe('0 мин 05 с');
    expect(formatDuration(65_000)).toBe('1 мин 05 с');
    expect(formatDuration(7_800_000)).toBe('2 ч 10 мин 00 с');
  });

  it('exports actual totals, range, quality and escaped filenames', () => {
    const metrics = {
      starts: 1,
      completed: 1,
      confirmed: 0,
      partial: 1,
      unconfirmed: 0,
      playedMs: 2000,
      errors: 0,
      skipped: 0,
      interrupted: 0,
      successfulMs: 1000,
    };
    const data = {
      playerId: 1,
      timeZone: 'Europe/Moscow',
      today: '2026-10-09',
      generatedAt: '',
      requestedDates: { from: '2026-10-03', to: '2026-10-09' },
      requested: { from: '', to: '' },
      available: null,
      effective: null,
      clipped: true,
      totals: metrics,
      rows: [{ ...metrics, mediaId: 'x', filename: '=SUM(1,2)"clip' }],
      outputs: [
        {
          ...metrics,
          id: 5,
          name: 'Сцена',
          display: 7,
          reasons: [{ reason: 'missing', count: 1 }],
        },
      ],
      outputId: 5,
      days: [],
      quality: {
        ignoredLegacyRecords: 2,
        invalidRecords: 0,
        incompleteAttempts: 0,
        unreadableFiles: 0,
      },
    } satisfies PlaybackStatistics;
    const csv = statisticsCsv(data);
    expect(csv).toContain('"Запрошенные даты","2026-10-03","2026-10-09"');
    expect(csv).toContain('"Устаревших записей пропущено","2"');
    expect(csv).toContain('"Попыток с неполными данными","0"');
    expect(csv).toContain('"Выход","Сцена · Выбранный дисплей"');
    expect(csv).toContain('"Итого","1","1","0","1","0","2000","1000"');
    expect(csv).toContain('"Сцена","5","7","0","1","0","1000","окно вывода отсутствует: 1"');
    expect(csv).toContain('"\'=SUM(1,2)""clip"');
  });

  it('reserves a readable width per day in the scrollable chart', () => {
    expect(MIN_STATISTICS_BAR_WIDTH).toBeGreaterThanOrEqual(48);
  });
});
