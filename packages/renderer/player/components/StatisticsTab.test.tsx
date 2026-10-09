import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackStatistics } from '/@common/playbackStatistics';

import StatisticsTab from './StatisticsTab';

const { statisticsQuery, historyQuery, remote } = vi.hoisted(() => ({
  remote: { version: '5.6.5', isRemoteSession: true },
  statisticsQuery: vi.fn(),
  historyQuery: vi.fn(),
}));
vi.mock('/@common/remote', () => remote);
vi.mock('../api/playback', () => ({
  useGetPlaybackStatisticsQuery: statisticsQuery,
  useGetPlaybackHistoryQuery: historyQuery,
}));
vi.mock('../utils', () => ({ sourceId: 7 }));

const metrics = {
  starts: 3,
  completed: 2,
  confirmed: 1,
  partial: 1,
  unconfirmed: 0,
  playedMs: 8_000_000,
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
  outputs: [
    {
      ...metrics,
      id: 1,
      name: 'Новый плеер - Вывод',
      display: -1,
      resolvedDisplayId: 1,
      reasons: [{ reason: 'hidden', count: 1 }],
    },
    {
      ...metrics,
      id: 2,
      name: 'Резервный',
      display: 3,
      reasons: [{ reason: 'missing', count: 1 }],
    },
  ],
  days: [
    { ...metrics, date: '2026-10-08', hasRecords: false, completed: 0, confirmed: 0 },
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
    remote.version = '5.6.5';
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
    expect(html).toContain('02:13:20 / 02:10:00');
    expect(html).toContain('Часть периода вне доступного журнала');
    expect(html).toContain('График подтверждённых показов, прокрутка по горизонтали');
    expect(html).toContain('data-bar-min-width="80"');
    expect(html).toContain('нет записей');
    expect(html).toContain('Новый плеер - Вывод · Основной дисплей');
    expect(html).toContain('Резервный · Выбранный дисплей');
    expect(html).toContain('выход скрыт: 1');
    expect(html).not.toContain('Качество журнала');
    expect(html).not.toContain('Попыток с неполными данными');
  });

  it('skips both queries when mounted directly on an older remote host', () => {
    remote.version = '5.6.4';
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Обновите GMIB на устройстве');
    expect(statisticsQuery).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ skip: true }),
    );
    expect(historyQuery).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ skip: true }),
    );
    expect(html).not.toContain('promo.mp4');
  });

  it('does not repeat boundaries when all available history is included', () => {
    statisticsQuery.mockReturnValue({ currentData: { ...data, effective: data.available } });
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Часть периода вне доступного журнала');
    expect(html).not.toContain('Показан интервал');
  });

  it('retains actual boundaries when only part of the available history is included', () => {
    statisticsQuery.mockReturnValue({
      currentData: {
        ...data,
        effective: { ...data.effective!, from: '2026-10-08T21:00:00Z' },
      },
    });
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Показан интервал 09.10.2026, 00:00:00');
  });

  it('reports incomplete attempts without obsolete file parsing counters', () => {
    statisticsQuery.mockReturnValue({
      currentData: { ...data, quality: { ...data.quality, incompleteAttempts: 2 } },
      isLoading: false,
      isError: false,
    });
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Попыток с неполными данными — 2');
    expect(html).toContain('не считаются успешными показами');
    expect(html).not.toContain('устаревших записей');
    expect(html).not.toContain('нечитаемых файлов');
  });

  it('explains an absent endpoint when the host version is unknown', () => {
    remote.version = '';
    statisticsQuery.mockReturnValue({
      currentData: undefined,
      isLoading: false,
      isError: true,
      error: { status: 404 },
    });
    const html = renderToStaticMarkup(<StatisticsTab />);
    expect(html).toContain('Обновите GMIB на устройстве');
  });

  it('passes the selected output to statistics and history queries', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<StatisticsTab />));
    const select = container.querySelector('[role="combobox"]');
    expect(select).not.toBeNull();
    act(() => {
      select?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    const option = [...document.querySelectorAll('[role="option"]')].find(item =>
      item.textContent?.includes('Основной'),
    );
    expect(option).toBeDefined();
    act(() => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(statisticsQuery).toHaveBeenLastCalledWith(
      { playerId: 7, outputId: 1 },
      expect.any(Object),
    );
    expect(historyQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ outputId: 1 }),
      expect.any(Object),
    );
    act(() => root.unmount());
    container.remove();
  });

  it('labels an observed empty output list in history', () => {
    historyQuery.mockReturnValue({
      currentData: {
        entries: [
          {
            playbackId: 'attempt-1',
            mediaId: 'clip-1',
            filename: 'promo.mp4',
            timestamp: '2026-10-09T10:00:00Z',
            outcome: 'completed',
            playedMs: 1000,
            successfulMs: 0,
            outputResult: { status: 'unconfirmed', outputs: [], reasons: ['missing'] },
            skipped: false,
            events: [
              { event: 'started', timestamp: '2026-10-09T10:00:00Z', output: { outputs: [] } },
            ],
          },
        ],
        total: 1,
        offset: 0,
        limit: 20,
      },
      isFetching: false,
      isError: false,
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<StatisticsTab />));
    const row = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'promo.mp4',
    );
    act(() => {
      row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('выходы не настроены');
    act(() => root.unmount());
    container.remove();
  });
});
