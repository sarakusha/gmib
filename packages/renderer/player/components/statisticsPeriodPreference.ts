import type { PlaybackStatisticsRange } from '/@common/playbackStatistics';
import type { StatisticsPreset } from './statisticsHelpers';

export type StatisticsPeriodPreference =
  | { preset: Exclude<StatisticsPreset, 'custom'> }
  | { preset: 'custom'; range: PlaybackStatisticsRange };

// У разных хостов могут совпадать номера плееров; выбор хранится для конкретного плеера.
export const statisticsPeriodKey = (host: string, port: number, playerId: number): string =>
  `gmib:statistics-period:${JSON.stringify([host, port, playerId])}`;

export const readStatisticsPeriod = (key: string): StatisticsPeriodPreference => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'preset' in value) {
      if (value.preset === 'today' || value.preset === 'yesterday' || value.preset === 'week')
        return { preset: value.preset };
    }
  } catch {
    // Повреждённое или недоступное хранилище не должно блокировать статистику.
  }
  return { preset: 'today' };
};

export const saveStatisticsPeriod = (key: string, value: StatisticsPeriodPreference): void => {
  try {
    // Произвольные даты нужны только текущему просмотру; после него открываем сегодня.
    window.localStorage.setItem(
      key,
      JSON.stringify({ preset: value.preset === 'custom' ? 'today' : value.preset }),
    );
  } catch {
    // Выбор продолжает работать в текущем окне даже без доступа к localStorage.
  }
};
