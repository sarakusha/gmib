import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import React from 'react';

import { useGetPlaybackHistoryQuery, useGetPlaybackStatisticsQuery } from '../api/playback';
import { sourceId } from '../utils';
import {
  formatDuration,
  isValidRange,
  MIN_STATISTICS_BAR_WIDTH,
  presetRange,
  statisticsCsv,
} from './statisticsHelpers';
import type { StatisticsPreset } from './statisticsHelpers';

import {
  PLAYBACK_HISTORY_MAX_OFFSET,
  type PlaybackStatisticsRange,
  type PlaybackStatisticsRow,
} from '/@common/playbackStatistics';

type SortKey = 'filename' | 'starts' | 'completed' | 'successfulMs' | 'errors' | 'skipped';
const columns: { key: SortKey; label: string }[] = [
  { key: 'filename', label: 'Ролик' },
  { key: 'starts', label: 'Запуски' },
  { key: 'completed', label: 'Завершено' },
  { key: 'successfulMs', label: 'Время показов' },
  { key: 'errors', label: 'Ошибки' },
  { key: 'skipped', label: 'Пропуски' },
];
const dateLabel = (date: string) => date.split('-').reverse().join('.');
const rangeLabel = (range: PlaybackStatisticsRange) =>
  `${dateLabel(range.from)} — ${dateLabel(range.to)}`;
const instantLabel = (value: string, timeZone: string) =>
  new Date(value).toLocaleString('ru-RU', { timeZone });
const instantRangeLabel = (range: PlaybackStatisticsRange, timeZone: string) =>
  `${instantLabel(range.from, timeZone)} — ${instantLabel(range.to, timeZone)}`;
const outcomeLabels = {
  completed: 'завершено',
  error: 'ошибка',
  interrupted: 'прервано',
  pending: 'не завершено',
} as const;
const eventLabels: Record<string, string> = {
  started: 'запуск',
  completed: 'завершение',
  error: 'ошибка',
  quarantined: 'отключено после ошибок',
  recovered: 'восстановлено',
  progress: 'воспроизведение',
  paused: 'пауза',
  seeked: 'перемотка',
  'details-truncated': 'детализация сокращена',
  resumed: 'возобновление',
  interrupted: 'прервано',
  skipped: 'пропущено',
};
const reasonLabels: Record<string, string> = {
  'engine-changed': 'смена движка',
  'item-changed': 'смена ролика',
  'playback-error': 'ошибка воспроизведения',
  'playlist-changed': 'смена плейлиста',
  'source-replaced': 'источник заменён',
  stopped: 'остановка',
};
const status = (error: unknown): number | string | undefined =>
  (error as FetchBaseQueryError | undefined)?.status;

const StatisticsTab: React.FC = () => {
  const [preset, setPreset] = React.useState<StatisticsPreset>('week');
  const [range, setRange] = React.useState<PlaybackStatisticsRange | undefined>();
  const [draft, setDraft] = React.useState<PlaybackStatisticsRange>({ from: '', to: '' });
  const [sortKey, setSortKey] = React.useState<SortKey>('completed');
  const [descending, setDescending] = React.useState(true);
  const [selected, setSelected] = React.useState<PlaybackStatisticsRow | null>(null);
  const [offset, setOffset] = React.useState(0);
  const query = useGetPlaybackStatisticsQuery(
    { playerId: sourceId, ...range },
    {
      refetchOnMountOrArgChange: true,
    },
  );
  const data = query.currentData;
  const history = useGetPlaybackHistoryQuery(
    {
      playerId: sourceId,
      ...range,
      mediaId: selected?.mediaId ?? '',
      offset,
      limit: 20,
    },
    { skip: !selected, refetchOnMountOrArgChange: true },
  );
  const historyData = history.currentData;

  const choosePreset = (_: React.MouseEvent<HTMLElement>, next: StatisticsPreset | null) => {
    if (!next) return;
    setPreset(next);
    if (next === 'custom') {
      setDraft(data?.requestedDates ?? range ?? { from: '', to: '' });
    } else if (data?.today) {
      setRange(presetRange(next, data.today));
    }
    setSelected(null);
  };
  const applyCustom = () => {
    if (isValidRange(draft)) {
      setRange(draft);
      setSelected(null);
    }
  };
  const refresh = () => {
    void query.refetch().then(result => {
      if (result.data?.today && preset !== 'custom') {
        setRange(presetRange(preset, result.data.today));
      }
    });
  };
  const sortedRows = React.useMemo(
    () =>
      [...(data?.rows ?? [])].sort((a, b) => {
        const comparison =
          sortKey === 'filename'
            ? a.filename.localeCompare(b.filename, 'ru')
            : a[sortKey] - b[sortKey];
        return (descending ? -1 : 1) * comparison;
      }),
    [data?.rows, sortKey, descending],
  );
  const changeSort = (key: SortKey) => {
    setDescending(sortKey === key ? !descending : key !== 'filename');
    setSortKey(key);
  };
  const exportCsv = () => {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', statisticsCsv(data)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `gmib-statistics-${sourceId}-${data.requestedDates.from}-${data.requestedDates.to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Box sx={{ height: 1, overflowY: 'auto', maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={preset}
          onChange={choosePreset}
          aria-label="Период статистики"
        >
          <ToggleButton value="today" disabled={!data}>
            Сегодня
          </ToggleButton>
          <ToggleButton value="yesterday" disabled={!data}>
            Вчера
          </ToggleButton>
          <ToggleButton value="week" disabled={!data}>
            7 дней
          </ToggleButton>
          <ToggleButton value="custom">Период</ToggleButton>
        </ToggleButtonGroup>
        {data && (
          <Typography variant="body2" color="text.secondary">
            Время плеера: {data.timeZone}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="text" onClick={refresh} disabled={query.isFetching} size="small">
          Обновить
        </Button>
        <Button variant="outlined" onClick={exportCsv} disabled={!data} size="small">
          Экспорт CSV
        </Button>
      </Stack>
      {preset === 'custom' && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
          <TextField
            size="small"
            type="date"
            label="С"
            value={draft.from}
            onChange={event => setDraft({ ...draft, from: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="date"
            label="По"
            value={draft.to}
            onChange={event => setDraft({ ...draft, to: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button onClick={applyCustom} disabled={!isValidRange(draft)} variant="contained">
            Показать
          </Button>
          {draft.from && draft.to && !isValidRange(draft) && (
            <Typography color="error">Проверьте даты периода</Typography>
          )}
        </Stack>
      )}
      {query.isFetching && !data && (
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <CircularProgress size={20} />
          Загрузка статистики…
        </Stack>
      )}
      {query.isError &&
        (status(query.error) === 404 ? (
          <Alert severity="info">
            На этом плеере статистика недоступна. Обновите GMIB на устройстве.
          </Alert>
        ) : (
          <Alert
            severity="error"
            action={<Button onClick={() => void query.refetch()}>Повторить</Button>}
          >
            Не удалось загрузить статистику.
          </Alert>
        ))}
      {data && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Typography variant="body2">
              Запрошено: {rangeLabel(data.requestedDates)} · {data.timeZone}
            </Typography>
            <Typography variant="body2">
              Доступные записи:{' '}
              {data.available ? instantRangeLabel(data.available, data.timeZone) : 'нет'}
            </Typography>
            {data.clipped && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Часть периода вне доступного журнала. Показан интервал{' '}
                {data.effective ? instantRangeLabel(data.effective, data.timeZone) : 'без записей'}.
              </Alert>
            )}
          </Paper>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
              gap: 2,
              mb: 3,
            }}
          >
            {[
              [
                'Время успешных показов',
                formatDuration(data.totals.successfulMs),
                'Без неудачных попыток',
              ],
              ['Завершено', data.totals.completed, `Запусков: ${data.totals.starts}`],
              ['Ошибки', data.totals.errors, 'Включая повторные попытки'],
              ['Пропуски из-за ошибок', data.totals.skipped, 'Переходы к следующему ролику'],
            ].map(([label, value, caption]) => (
              <Box key={label}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {caption}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="h6" gutterBottom>
            Завершённые показы по дням
          </Typography>
          <Box
            role="region"
            tabIndex={0}
            aria-label="График завершённых показов, прокрутка по горизонтали"
            sx={{ overflowX: 'auto', maxWidth: '100%', mb: 3 }}
          >
            <Box
              sx={{
                display: 'flex',
                width: 'max-content',
                minWidth: '100%',
                height: 185,
                gap: 1,
                alignItems: 'end',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {data.days.map(day => (
                <Box
                  key={day.date}
                  data-bar-min-width={MIN_STATISTICS_BAR_WIDTH}
                  title={`${day.date}: ${day.hasRecords ? day.completed : 'нет записей'}`}
                  sx={{
                    flex: `0 0 ${MIN_STATISTICS_BAR_WIDTH}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'end',
                    height: '100%',
                  }}
                >
                  <Typography variant="caption">
                    {day.hasRecords ? day.completed : 'нет записей'}
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      minHeight: day.completed ? 4 : 0,
                      height: `${data.days.length ? (day.completed / Math.max(1, ...data.days.map(item => item.completed))) * 135 : 0}px`,
                      bgcolor: day.hasRecords ? 'primary.main' : 'action.disabledBackground',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    {dateLabel(day.date).slice(0, 5)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Typography variant="h6" gutterBottom>
            Контент
          </Typography>
          {data.rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              За выбранный период записей нет.
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map(column => (
                      <TableCell
                        key={column.key}
                        align={column.key === 'filename' ? 'left' : 'right'}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        <TableSortLabel
                          active={sortKey === column.key}
                          direction={sortKey === column.key && descending ? 'desc' : 'asc'}
                          onClick={() => changeSort(column.key)}
                        >
                          {column.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRows.map(row => (
                    <TableRow key={row.mediaId} hover>
                      <TableCell>
                        <Button
                          sx={{ textTransform: 'none', textAlign: 'left' }}
                          onClick={() => {
                            setSelected(row);
                            setOffset(0);
                          }}
                        >
                          {row.filename}
                        </Button>
                      </TableCell>
                      <TableCell align="right">{row.starts}</TableCell>
                      <TableCell align="right">{row.completed}</TableCell>
                      <TableCell align="right">{formatDuration(row.successfulMs)}</TableCell>
                      <TableCell align="right">{row.errors}</TableCell>
                      <TableCell align="right">{row.skipped}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            Качество журнала: пропущено устаревших записей — {data.quality.ignoredLegacyRecords},
            некорректных — {data.quality.invalidRecords}, попыток с неполными данными —{' '}
            {data.quality.incompleteAttempts}, нечитаемых файлов — {data.quality.unreadableFiles}.
          </Typography>
        </>
      )}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>История: {selected?.filename}</DialogTitle>
        <DialogContent dividers>
          {history.isFetching && !historyData && <CircularProgress size={20} />}
          {history.isError && (
            <Alert
              severity="error"
              action={<Button onClick={() => void history.refetch()}>Повторить</Button>}
            >
              Не удалось загрузить историю.
            </Alert>
          )}
          {historyData?.entries.length === 0 && <Typography>Записей нет.</Typography>}
          {historyData?.entries.map(entry => (
            <Paper variant="outlined" key={entry.playbackId} sx={{ p: 1.5, mb: 1 }}>
              <Typography variant="body2">
                {new Date(entry.startedAt ?? entry.timestamp).toLocaleString('ru-RU', {
                  timeZone: data?.timeZone,
                })}{' '}
                · {outcomeLabels[entry.outcome]} · {formatDuration(entry.playedMs)}
                {entry.skipped ? ' · пропуск' : ''}
              </Typography>
              {entry.events.map((event, index) => (
                <Typography
                  key={`${event.timestamp}-${index}`}
                  variant="caption"
                  sx={{ display: 'block' }}
                  color="text.secondary"
                >
                  {new Date(event.timestamp).toLocaleTimeString('ru-RU', {
                    timeZone: data?.timeZone,
                  })}{' '}
                  · {eventLabels[event.event] ?? 'другое событие'}
                  {event.reason ? ` · ${reasonLabels[event.reason] ?? event.reason}` : ''}
                  {event.error ? ` · ${event.error}` : ''}
                </Typography>
              ))}
            </Paper>
          ))}
        </DialogContent>
        {historyData && historyData.total > PLAYBACK_HISTORY_MAX_OFFSET + 20 && (
          <Alert severity="info" sx={{ mx: 3 }}>
            Для просмотра более ранних попыток сузьте выбранный период.
          </Alert>
        )}
        <DialogActions>
          {historyData && (
            <Typography variant="caption" sx={{ mr: 'auto', ml: 2 }}>
              {historyData.total
                ? `${offset + 1}–${Math.min(offset + historyData.entries.length, historyData.total)} из ${historyData.total}`
                : '0 записей'}
            </Typography>
          )}
          <Button
            disabled={offset === 0 || history.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Назад
          </Button>
          <Button
            disabled={
              !historyData ||
              offset + historyData.entries.length >= historyData.total ||
              offset + 20 > PLAYBACK_HISTORY_MAX_OFFSET ||
              history.isFetching
            }
            onClick={() => setOffset(offset + 20)}
          >
            Далее
          </Button>
          <Button onClick={() => setSelected(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatisticsTab;
