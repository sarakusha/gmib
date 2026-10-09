import type {
  PlaybackStatistics,
  PlaybackStatisticsRange,
  PlaybackStatisticsRow,
} from '/@common/playbackStatistics';
import type { PlaybackOutputState } from '/@common/playbackOutput';

export type StatisticsPreset = 'today' | 'yesterday' | 'week' | 'custom';

/** Calendar arithmetic deliberately uses UTC components, never the viewer's time zone. */
export const shiftDate = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
};

export const presetRange = (
  preset: Exclude<StatisticsPreset, 'custom'>,
  today: string,
): PlaybackStatisticsRange => {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = shiftDate(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case 'week':
      return { from: shiftDate(today, -6), to: today };
  }
};

export const isValidRange = ({ from, to }: PlaybackStatisticsRange): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(from) &&
  /^\d{4}-\d{2}-\d{2}$/.test(to) &&
  !Number.isNaN(Date.parse(`${from}T00:00:00Z`)) &&
  !Number.isNaN(Date.parse(`${to}T00:00:00Z`)) &&
  new Date(`${from}T00:00:00Z`).toISOString().slice(0, 10) === from &&
  new Date(`${to}T00:00:00Z`).toISOString().slice(0, 10) === to &&
  from <= to;

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours
    ? `${hours} ч ${String(minutes).padStart(2, '0')} мин ${String(remainingSeconds).padStart(2, '0')} с`
    : `${minutes} мин ${String(remainingSeconds).padStart(2, '0')} с`;
};

export const outputStateLabels: Record<PlaybackOutputState, string> = {
  showing: 'показ идёт',
  hidden: 'выход скрыт',
  unavailable: 'монитор недоступен',
  missing: 'окно вывода отсутствует',
  starting: 'ожидание вывода',
  stalled: 'вывод остановился',
  unknown: 'состояние неизвестно',
};

export const outputName = (output: {
  id: number;
  name: string;
  display?: string | number;
  resolvedDisplayId?: string | number;
}): string =>
  `${output.name || `Выход ${output.id}`} (№${output.id}${output.display !== undefined ? `, экран ${output.display}` : ''}${output.resolvedDisplayId !== undefined && output.resolvedDisplayId !== output.display ? ` → ${output.resolvedDisplayId}` : ''})`;

const csvCell = (value: string | number): string => {
  const text = String(value);
  // Quoting plus an apostrophe prevents spreadsheet formula execution.
  const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const statisticsCsv = (data: PlaybackStatistics): string => {
  const columns = [
    'Ролик',
    'Запуски',
    'Завершено источником',
    'Подтверждено',
    'Частично',
    'Не подтверждено',
    'Активное время источника (мс)',
    'Время исправного вывода завершённых попыток (мс)',
    'Ошибки',
    'Пропуски',
    'Прервано',
  ];
  const line = (values: (string | number)[]) => values.map(csvCell).join(',');
  const metrics = (row: PlaybackStatisticsRow) => [
    row.filename,
    row.starts,
    row.completed,
    row.confirmed,
    row.partial,
    row.unconfirmed,
    row.playedMs,
    row.successfulMs,
    row.errors,
    row.skipped,
    row.interrupted,
  ];
  return [
    line(['Плеер', data.playerId]),
    line(['Часовой пояс', data.timeZone]),
    line(['Запрошенные даты', data.requestedDates.from, data.requestedDates.to]),
    line([
      'Выход',
      data.outputId === undefined
        ? 'Все настроенные'
        : outputName(
            data.outputs.find(output => output.id === data.outputId) ?? {
              id: data.outputId,
              name: '',
            },
          ),
    ]),
    line(['Фактический интервал', data.effective?.from ?? '', data.effective?.to ?? '']),
    line(['Доступные записи', data.available?.from ?? '', data.available?.to ?? '']),
    line(['Диапазон сокращён', data.clipped ? 'да' : 'нет']),
    line(['Устаревших записей пропущено', data.quality.ignoredLegacyRecords]),
    line(['Некорректных записей', data.quality.invalidRecords]),
    line(['Попыток с неполными данными', data.quality.incompleteAttempts]),
    line(['Нечитаемых файлов журнала', data.quality.unreadableFiles]),
    '',
    line(columns),
    line(metrics({ ...data.totals, mediaId: '', filename: 'Итого' })),
    ...data.rows.map(row => line(metrics(row))),
    '',
    line(['Выходы (все настроенные; независимо от фильтра)']),
    line([
      'Выход',
      'ID',
      'Экран',
      'Подтверждено',
      'Частично',
      'Не подтверждено',
      'Время исправного вывода (мс)',
      'Причины',
    ]),
    ...data.outputs.map(output =>
      line([
        output.name,
        output.id,
        output.display ?? '',
        output.confirmed,
        output.partial,
        output.unconfirmed,
        output.successfulMs,
        output.reasons
          .map(({ reason, count }) => `${outputStateLabels[reason]}: ${count}`)
          .join('; '),
      ]),
    ),
  ].join('\r\n');
};

export const MIN_STATISTICS_BAR_WIDTH = 80;
