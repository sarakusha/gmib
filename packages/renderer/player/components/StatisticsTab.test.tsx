import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackStatistics } from '/@common/playbackStatistics';

import StatisticsTab from './StatisticsTab';

const { statisticsQuery, historyQuery } = vi.hoisted(() => ({
  statisticsQuery: vi.fn(),
  historyQuery: vi.fn(),
}));
vi.mock('../api/playback', () => ({
  useGetPlaybackStatisticsQuery: statisticsQuery,
  useGetPlaybackHistoryQuery: historyQuery,
}));
vi.mock('../utils', () => ({ sourceId: 7 }));

const metrics = {
  starts: 3,
  completed: 2,
  errors: 1,
  skipped: 1,
  interrupted: 0,
  successfulMs: 7800000,
};
const data: PlaybackStatistics = {
  playerId: 7,
  timeZone: 'Europe/Moscow',
  today: '2026-10-09',
  generatedAt: '2026-10-09T10:00:00Z',
  requestedDates: { from: '2026-10-03', to: '2026-10-09' },
  requested: { from: '2026-10-02T21:00:00Z', to: '2026-10-09T21:00:00Z' },
  available: { from: '2026-10-04T05:00:00Z', to: '2026-10-09T10:00:00Z' },
  effective: { from: '2026-10-04T05:00:00Z', to: '2026-10-09T10:00:00Z' },
  clipped: true,
  totals: metrics,
  rows: [{ ...metrics, mediaId: 'clip-1', filename: 'promo.mp4' }],
  days: [
    { ...metrics, date: '2026-10-08', hasRecords: false, completed: 0 },
    { ...metrics, date: '2026-10-09', hasRecords: true },
  ],
  quality: {
    ignoredLegacyRecords: 1,
    invalidRecords: 0,
    incompleteAttempts: 0,
    unreadableFiles: 0,
  },
};

describe('StatisticsTab', () => {
  beforeEach(() => {
    statisticsQuery
      .mockReset()
      .mockReturnValue({ currentData: data, isLoading: false, isError: false });
    historyQuery
      .mockReset()
      .mockReturnValue({ currentData: undefined, isLoading: false, isError: false });
  });

  it('renders host data and a scrollable daily chart with a fixed bar width', () => {
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(statisticsQuery).toHaveBeenCalledWith({ playerId: 7 }, expect.any(Object));
    expect(historyQuery).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 7, mediaId: '' }),
      expect.objectContaining({ skip: true }),
    );
    expect(html).toContain('promo.mp4');
    expect(html).toContain('2 ч 10 мин 00 с');
    expect(html).toContain('Часть периода вне доступного журнала');
    expect(html).toContain('График завершённых показов, прокрутка по горизонтали');
    expect(html).toContain('data-bar-min-width="80"');
    expect(html).toContain('нет записей');
  });

  it('explains unsupported older hosts', () => {
    statisticsQuery.mockReturnValue({
      currentData: undefined,
      isLoading: false,
      isError: true,
      error: { status: 404 },
    });
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Обновите GMIB на устройстве');
  });
});
