import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { FC } from 'react';
import type { PlaybackHistoryEntry } from '/@common/playbackStatistics';

import { historyOutputChanges } from './playbackHistoryHelpers';
import { outputDetails, outputName, outputStateLabels } from './statisticsHelpers';

const outcomeLabels = {
  completed: 'завершение',
  error: 'ошибка',
  interrupted: 'прервано',
  pending: 'не завершено',
};
const eventLabels: Record<string, string> = {
  error: 'ошибка',
  quarantined: 'отключено после ошибок',
  recovered: 'восстановлено',
  paused: 'пауза',
  seeked: 'перемотка',
  'details-truncated': 'детализация сокращена',
  resumed: 'возобновление',
  interrupted: 'прервано',
  skipped: 'пропущено',
};
const resultLabels = {
  confirmed: 'вывод подтверждён',
  partial: 'вывод частичный',
  unconfirmed: 'вывод не подтверждён',
};
const reasonLabels: Record<string, string> = {
  'engine-changed': 'смена движка',
  'item-changed': 'смена ролика',
  'playback-error': 'ошибка воспроизведения',
  'playlist-changed': 'смена плейлиста',
  'source-replaced': 'источник заменён',
  stopped: 'остановка',
};
const combinedEvents = new Set(['started', 'completed', 'output-changed', 'progress']);
type Tone = 'normal' | 'problem' | 'recovery';
type HistoryRow = {
  timestamp: string;
  priority: number;
  tone: Tone;
  title?: string;
  label: string;
  showTime: boolean;
};
const rowStyle =
  (tone: Tone): SxProps<Theme> =>
  theme => ({
    display: 'block',
    px: 1,
    py: 0.25,
    borderLeft: '2px solid',
    borderColor:
      tone === 'normal'
        ? 'transparent'
        : alpha(theme.palette[tone === 'problem' ? 'error' : 'success'].main, 0.35),
    backgroundColor:
      tone === 'normal'
        ? 'transparent'
        : alpha(theme.palette[tone === 'problem' ? 'error' : 'success'].main, 0.05),
    color: 'text.secondary',
    overflowWrap: 'anywhere',
  });

/** Compact presentation only: persisted events, statistics and CSV stay unchanged. */
const PlaybackHistoryItem: FC<{ entry: PlaybackHistoryEntry; timeZone?: string }> = ({
  entry,
  timeZone,
}) => {
  const date = (at: string) => new Date(at).toLocaleDateString('ru-RU', { timeZone });
  const time = (at: string) => new Date(at).toLocaleTimeString('ru-RU', { timeZone });
  const start = entry.startedAt ?? entry.events.find(event => event.event === 'started')?.timestamp;
  const reference = start ?? entry.timestamp;
  const instant = (at: string) =>
    date(at) === date(reference) ? time(at) : `${date(at)}, ${time(at)}`;
  const changes = historyOutputChanges(entry);
  const rows = [
    ...changes.map<HistoryRow>(change => ({
      timestamp: change.timestamp,
      priority: 1,
      tone: change.tone,
      title: change.output ? outputDetails(change.output) : undefined,
      label: change.output
        ? `${outputName(change.output)}: ${
            change.kind === 'removed'
              ? 'выход больше не используется'
              : change.tone === 'recovery'
                ? 'показ восстановлен'
                : outputStateLabels[change.output.state]
          }`
        : 'выходы не настроены',
      showTime: change.kind !== 'initial' || change.timestamp !== start,
    })),
    ...entry.events
      .filter(event => !combinedEvents.has(event.event))
      .map<HistoryRow>(event => ({
        timestamp: event.timestamp,
        priority: event.event === 'details-truncated' ? 0 : 2,
        tone: event.event === 'error' || event.event === 'skipped' ? 'problem' : 'normal',
        title: undefined,
        label: `${eventLabels[event.event] ?? 'другое событие'}${
          event.reason ? ` · ${reasonLabels[event.reason] ?? event.reason}` : ''
        }${event.error ? ` · ${event.error}` : ''}`,
        showTime: true,
      })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.priority - b.priority);
  // A cumulative result may retain a problem whose event is outside the retained detail.
  // Keep that information without repeating reasons already visible in the timeline.
  const notes = entry.outputResult?.outputs.flatMap(output => {
    const unseen = output.reasons.filter(
      reason =>
        !changes.some(change => change.outputId === output.id && change.output?.state === reason),
    );
    return unseen.length
      ? [`${outputName(output)}: ${unseen.map(reason => outputStateLabels[reason]).join(', ')}`]
      : [];
  });

  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1 }} data-playback-history={entry.playbackId}>
      <Typography variant="body2" sx={{ mb: 0.5, overflowWrap: 'anywhere' }}>
        {date(reference)} · {start ? `запуск ${time(start)} → ` : ''}
        {outcomeLabels[entry.outcome]}
        {entry.outcome !== 'pending' ? ` ${instant(entry.timestamp)}` : ''}
        {entry.outcome === 'completed' && entry.outputResult?.status !== 'confirmed'
          ? ` · ${resultLabels[entry.outputResult?.status ?? 'unconfirmed']}`
          : ''}
        {entry.skipped && !entry.events.some(event => event.event === 'skipped')
          ? ' · пропуск'
          : ''}
      </Typography>
      <Box>
        {rows.map((row, index) => (
          <Typography
            key={`${row.timestamp}-${index}`}
            variant="caption"
            title={row.title}
            sx={rowStyle(row.tone)}
            data-history-tone={row.tone}
          >
            {row.showTime ? `${instant(row.timestamp)} · ` : ''}
            {row.label}
          </Typography>
        ))}
        {changes.length === 0 && (
          <Typography variant="caption" sx={rowStyle('normal')}>
            Сведения о выводе отсутствуют.
          </Typography>
        )}
        {notes?.map(note => (
          <Typography key={note} variant="caption" sx={rowStyle('normal')}>
            Итог вывода · {note}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

export default PlaybackHistoryItem;
