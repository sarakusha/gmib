import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlaybackHistoryEntry } from '/@common/playbackStatistics';
import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';

import PlaybackHistoryItem from './PlaybackHistoryItem';

const output: PlaybackOutputSnapshot = {
  id: 1,
  name: 'Плеер - Вывод',
  display: -1,
  resolvedDisplayId: 1,
  state: 'showing',
};
const start = '2026-10-09T15:34:43.000Z';
const end = '2026-10-09T15:34:52.000Z';
const entry: PlaybackHistoryEntry = {
  playbackId: 'attempt-1',
  mediaId: 'clip',
  filename: 'clip.mp4',
  startedAt: start,
  timestamp: end,
  outcome: 'completed',
  playedMs: 9000,
  successfulMs: 9000,
  outputResult: {
    status: 'confirmed',
    outputs: [{ ...output, status: 'confirmed', reasons: [] }],
    reasons: [],
  },
  skipped: false,
  events: [
    { event: 'started', timestamp: start, output: { outputs: [output] } },
    { event: 'completed', timestamp: end, output: { outputs: [output] } },
  ],
};
const render = (value = entry) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(
    <PlaybackHistoryItem entry={value} timeZone="Europe/Moscow" />,
  );
  container.querySelectorAll('style').forEach(style => style.remove());
  return container;
};

describe('compact playback history item', () => {
  it('combines source start/end and displays a stable output only once without duration metrics', () => {
    const element = render();
    expect(element.textContent).toContain('09.10.2026 · запуск 18:34:43 → завершение 18:34:52');
    expect(element.textContent?.match(/Плеер - Вывод/g)).toHaveLength(1);
    expect(element.textContent?.match(/показ идёт/g)).toHaveLength(1);
    expect(element.textContent).not.toContain('время');
    expect(element.textContent).not.toContain('00:00:09');
    expect(element.textContent).not.toContain('вывод подтверждён');
    expect(element.querySelectorAll('[data-history-tone]')).toHaveLength(1);
  });

  it('marks problem and recovery with textual labels and keeps pauses/errors in order', () => {
    const hidden = { ...output, state: 'unavailable' as const };
    const value: PlaybackHistoryEntry = {
      ...entry,
      outputResult: { ...entry.outputResult!, status: 'partial', reasons: ['unavailable'] },
      events: [
        entry.events[0],
        {
          event: 'output-changed',
          timestamp: '2026-10-09T15:34:45.000Z',
          output: { outputs: [hidden] },
        },
        { event: 'paused', timestamp: '2026-10-09T15:34:46.000Z', output: { outputs: [hidden] } },
        { event: 'error', timestamp: '2026-10-09T15:34:47.000Z', error: 'Read failed' },
        {
          event: 'output-changed',
          timestamp: '2026-10-09T15:34:48.000Z',
          output: { outputs: [output] },
        },
        entry.events[1],
      ],
    };
    const element = render(value);
    const rows = [...element.querySelectorAll('[data-history-tone]')];
    expect(rows.map(row => row.getAttribute('data-history-tone'))).toEqual([
      'normal',
      'problem',
      'normal',
      'problem',
      'recovery',
    ]);
    expect(rows[1].textContent).toContain(
      '18:34:45 · Плеер - Вывод · Основной дисплей: монитор недоступен',
    );
    expect(rows[2].textContent).toBe('18:34:46 · пауза');
    expect(rows[3].textContent).toBe('18:34:47 · ошибка · Read failed');
    expect(rows[4].textContent).toContain('показ восстановлен');
    expect(element.textContent?.match(/монитор недоступен/g)).toHaveLength(1);
  });

  it('shows the end date across midnight in the host time zone', () => {
    expect(
      render({
        ...entry,
        startedAt: '2026-10-08T20:59:58.000Z',
        timestamp: '2026-10-08T21:00:07.000Z',
      }).textContent,
    ).toContain('08.10.2026 · запуск 23:59:58 → завершение 09.10.2026, 00:00:07');
  });

  it('does not label a pending observation time as completion', () => {
    const text = render({
      ...entry,
      outcome: 'pending',
      outputResult: undefined,
      events: entry.events.slice(0, 1),
    }).textContent;
    expect(text).toContain('запуск 18:34:43 → не завершено');
    expect(text).not.toContain('18:34:52');
  });

  it('preserves truncation, skip reasons, removed outputs and absent evidence', () => {
    const element = render({
      ...entry,
      skipped: true,
      events: [
        { event: 'details-truncated', timestamp: start, reason: 'Более ранних событий: 2' },
        entry.events[0],
        { event: 'output-changed', timestamp: end, output: { outputs: [] } },
        { event: 'skipped', timestamp: end, reason: 'playback-error' },
      ],
    });
    expect(element.textContent).toContain('детализация сокращена · Более ранних событий: 2');
    expect(element.textContent).toContain('выход больше не используется');
    expect(element.textContent).toContain('пропущено · ошибка воспроизведения');
    expect(render({ ...entry, outputResult: undefined, events: [] }).textContent).toContain(
      'Сведения о выводе отсутствуют',
    );
  });

  it('retains a cumulative reason when its original observation is outside detail', () => {
    const value: PlaybackHistoryEntry = {
      ...entry,
      outputResult: {
        status: 'partial',
        reasons: ['hidden'],
        outputs: [{ ...output, status: 'partial', reasons: ['hidden'] }],
      },
    };
    expect(render(value).textContent).toContain(
      'Итог вывода · Плеер - Вывод · Основной дисплей: выход скрыт',
    );
  });
});
