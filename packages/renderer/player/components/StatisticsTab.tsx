import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
  formatDurationPair,
  isValidRange,
  MIN_STATISTICS_BAR_WIDTH,
  outputDetails,
  outputName,
  outputStateLabels,
  presetRange,
  statisticsCsv,
} from './statisticsHelpers';
import type { StatisticsPreset } from './statisticsHelpers';

import {
  PLAYBACK_HISTORY_MAX_OFFSET,
  type PlaybackStatisticsRange,
  type PlaybackStatisticsRow,
} from '/@common/playbackStatistics';
import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';

type SortKey =
  | 'filename'
  | 'starts'
  | 'completed'
  | 'confirmed'
  | 'partial'
  | 'unconfirmed'
  | 'playedMs'
  | 'errors'
  | 'skipped';
const columns: { key: SortKey; label: string }[] = [
  { key: 'filename', label: 'Ролик' },
  { key: 'starts', label: 'Запуски' },
  { key: 'completed', label: 'Источник завершён' },
  { key: 'confirmed', label: 'Подтверждено' },
  { key: 'partial', label: 'Частично' },
  { key: 'unconfirmed', label: 'Не подтверждено' },
  { key: 'playedMs', label: 'Время: общее / исправное' },
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
  completed: 'источник завершён',
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
  'output-changed': 'состояние выхода изменилось',
};
const resultLabels = {
  confirmed: 'вывод подтверждён',
  partial: 'вывод частичный',
  unconfirmed: 'вывод не подтверждён',
} as const;
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
  const supported = supportsFeature('playbackStatistics', version, isRemoteSession);
  const [preset, setPreset] = React.useState<StatisticsPreset>('week');
  const [range, setRange] = React.useState<PlaybackStatisticsRange | undefined>();
  const [draft, setDraft] = React.useState<PlaybackStatisticsRange>({ from: '', to: '' });
  const [sortKey, setSortKey] = React.useState<SortKey>('confirmed');
  const [descending, setDescending] = React.useState(true);
  const [selected, setSelected] = React.useState<PlaybackStatisticsRow | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [outputId, setOutputId] = React.useState<number | undefined>();
  const query = useGetPlaybackStatisticsQuery(
    { playerId: sourceId, ...range, outputId },
    {
      skip: !supported,
      refetchOnMountOrArgChange: true,
    },
  );
  const data = supported ? query.currentData : undefined;
  const history = useGetPlaybackHistoryQuery(
    {
      playerId: sourceId,
      ...range,
      outputId,
      mediaId: selected?.mediaId ?? '',
      offset,
      limit: 20,
    },
    { skip: !supported || !selected, refetchOnMountOrArgChange: true },
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
    link.download = `gmib-statistics-${sourceId}-${data.requestedDates.from}-${data.requestedDates.to}${outputId === undefined ? '' : `-output-${outputId}`}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!supported) {
    return (
      <Alert severity="info">
        На этом плеере статистика недоступна. Обновите GMIB на устройстве.
      </Alert>
    );
  }

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
        {data && (
          <TextField
            select
            size="small"
            label="Выход"
            value={outputId ?? 'all'}
            onChange={event => {
              setOutputId(event.target.value === 'all' ? undefined : Number(event.target.value));
              setSelected(null);
              setOffset(0);
            }}
            sx={{ minWidth: 190, maxWidth: '100%' }}
          >
            <MenuItem value="all">Все настроенные выходы</MenuItem>
            {data.outputs.map(output => (
              <MenuItem key={output.id} value={output.id} title={outputDetails(output)}>
                {outputName(output)}
              </MenuItem>
            ))}
          </TextField>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              gap: 3,
              mb: 3,
            }}
          >
            <Box>
              <Typography variant="subtitle2">Время</Typography>
              <Typography variant="caption" color="text.secondary">
                Общее / Исправный вывод · чч:мм:сс
              </Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', my: 0.5 }}>
                {formatDurationPair(data.totals.playedMs, data.totals.successfulMs)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Общее — все попытки. Исправный вывод — только завершённые.
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Показы</Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', my: 0.5 }}>
                {data.totals.confirmed} подтверждено
              </Typography>
              <Typography variant="body2">
                Частично: {data.totals.partial} · Не подтверждено: {data.totals.unconfirmed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Завершено воспроизведений: {data.totals.completed} · Запусков: {data.totals.starts}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Ошибки и пропуски</Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', my: 0.5 }}>
                {data.totals.errors} / {data.totals.skipped}
              </Typography>
              <Typography variant="body2">Ошибки / Пропуски из-за ошибок</Typography>
              <Typography variant="caption" color="text.secondary">
                Ошибка может завершиться успешной повторной попыткой без пропуска.
              </Typography>
            </Box>
          </Box>
          <Typography variant="h6" gutterBottom>
            Подтверждённые показы по дням
          </Typography>
          <Box
            role="region"
            tabIndex={0}
            aria-label="График подтверждённых показов, прокрутка по горизонтали"
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
                  title={`${day.date}: ${day.hasRecords ? day.confirmed : 'нет записей'}`}
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
                    {day.hasRecords ? day.confirmed : 'нет записей'}
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      minHeight: day.confirmed ? 4 : 0,
                      height: `${data.days.length ? (day.confirmed / Math.max(1, ...data.days.map(item => item.confirmed))) * 135 : 0}px`,
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
                      <TableCell align="right">{row.confirmed}</TableCell>
                      <TableCell align="right">{row.partial}</TableCell>
                      <TableCell align="right">{row.unconfirmed}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ whiteSpace: 'nowrap' }}
                        title="Общее время / Исправный вывод · чч:мм:сс"
                      >
                        {formatDurationPair(row.playedMs, row.successfulMs)}
                      </TableCell>
                      <TableCell align="right">{row.errors}</TableCell>
                      <TableCell align="right">{row.skipped}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {data.outputs.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
                Выходы
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                Сводка по всем настроенным выходам за период, независимо от выбранного фильтра.
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Выход и экран</TableCell>
                      <TableCell align="right">Подтверждено</TableCell>
                      <TableCell align="right">Частично</TableCell>
                      <TableCell align="right">Не подтверждено</TableCell>
                      <TableCell align="right">Время: общее / исправное</TableCell>
                      <TableCell>Причины</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.outputs.map(output => (
                      <TableRow key={output.id}>
                        <TableCell title={outputDetails(output)}>{outputName(output)}</TableCell>
                        <TableCell align="right">{output.confirmed}</TableCell>
                        <TableCell align="right">{output.partial}</TableCell>
                        <TableCell align="right">{output.unconfirmed}</TableCell>
                        <TableCell
                          align="right"
                          sx={{ whiteSpace: 'nowrap' }}
                          title="Общее время / Исправный вывод · чч:мм:сс"
                        >
                          {formatDurationPair(output.playedMs, output.successfulMs)}
                        </TableCell>
                        <TableCell>
                          {output.reasons
                            .map(({ reason, count }) => `${outputStateLabels[reason]}: ${count}`)
                            .join('; ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {data.quality.incompleteAttempts > 0 && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              Попыток с неполными данными — {data.quality.incompleteAttempts}. Без сохранённого
              завершения они не считаются успешными показами.
            </Typography>
          )}
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
                · {outcomeLabels[entry.outcome]}
                {' · '}время (общее / исправное):{' '}
                {formatDurationPair(entry.playedMs, entry.successfulMs)}
                {entry.outcome === 'completed'
                  ? ` · ${entry.outputResult && entry.events.some(event => event.output) ? resultLabels[entry.outputResult.status] : 'вывод не подтверждён'}`
                  : ''}
                {entry.skipped ? ' · пропуск' : ''}
              </Typography>
              {entry.outputResult?.outputs.map(output => (
                <Typography
                  key={output.id}
                  title={outputDetails(output)}
                  variant="caption"
                  sx={{ display: 'block' }}
                >
                  {outputName(output)} · {resultLabels[output.status]}
                  {output.reasons.length
                    ? ` · ${output.reasons.map(reason => outputStateLabels[reason]).join(', ')}`
                    : ''}
                </Typography>
              ))}
              {entry.outputResult &&
                entry.outputResult.outputs.length === 0 &&
                entry.events.some(event => event.output) && (
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    выходы не настроены
                  </Typography>
                )}
              {entry.events.map((event, index) => (
                <Typography
                  key={`${event.timestamp}-${index}`}
                  variant="caption"
                  sx={{ display: 'block' }}
                  color="text.secondary"
                  title={event.output?.outputs.map(outputDetails).join(' ')}
                >
                  {new Date(event.timestamp).toLocaleTimeString('ru-RU', {
                    timeZone: data?.timeZone,
                  })}{' '}
                  · {eventLabels[event.event] ?? 'другое событие'}
                  {event.reason ? ` · ${reasonLabels[event.reason] ?? event.reason}` : ''}
                  {event.error ? ` · ${event.error}` : ''}
                  {event.output
                    ? event.output.outputs.length
                      ? ` · ${event.output.outputs.map(output => `${outputName(output)}: ${outputStateLabels[output.state]}`).join('; ')}`
                      : ' · выходы не настроены'
                    : ''}
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
