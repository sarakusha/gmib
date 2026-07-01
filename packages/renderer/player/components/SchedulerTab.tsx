import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorIcon from '@mui/icons-material/Error';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import React from 'react';

import type { Playlist } from '/@common/playlist';
import type {
  CronMode,
  CronPart,
  PlayerSchedulerAction,
  PlayerSchedulerJob,
  PlayerSchedulerJobInput,
  ScheduleKind,
  SimpleCronMode,
  SimpleCronPart,
} from '/@common/scheduler';
import {
  cronToString,
  defaultCron,
  describeCron,
  normalizeSelected,
  partToCron,
  simplePartToCron,
} from '/@common/scheduler';

import { useGetPlaylists } from '../api/playlists';
import {
  useCreateSchedulerJobMutation,
  useDeleteSchedulerJobMutation,
  useGetSchedulerJobsQuery,
  useRunSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
} from '../api/scheduler';
import { sourceId } from '../utils';

import Toolbar from './StyledToolbar';
import Checkbox from '@mui/material/Checkbox';
import { styled } from '@mui/material/styles';

type DialogValues = PlayerSchedulerJobInput;

const actionLabels: Record<PlayerSchedulerAction, string> = {
  'load-playlist': 'Загрузить и воспроизвести',
  'toggle-play': 'Переключить воспроизведение',
  play: 'Начать воспроизведение',
  stop: 'Остановить воспроизведение',
  'hide-output': 'Скрыть окно вывода',
  'show-output': 'Показать окно вывода',
  next: 'Следующий ролик',
  'play-item': 'Запустить ролик по номеру',
};

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;

const getActionName = (
  job: Pick<
    PlayerSchedulerJobInput,
    'action' | 'playlistId' | 'itemNumber' | 'hideOutputOnStop' | 'outputAll'
  >,
  playlists: Playlist[],
): string => {
  if (job.action === 'load-playlist') {
    const playlist = playlists.find(item => item.id === job.playlistId);
    return `${actionLabels[job.action]}${playlist ? `: ${playlist.name}` : ''}`;
  }
  if (job.action === 'play-item') {
    return `${actionLabels[job.action]}${job.itemNumber ? ` ${job.itemNumber}` : ''}`;
  }
  if (job.action === 'stop' && job.hideOutputOnStop) {
    return `${actionLabels[job.action]} и скрыть окно вывода`;
  }
  if ((job.action === 'hide-output' || job.action === 'show-output') && job.outputAll) {
    return `${actionLabels[job.action]}: все плееры`;
  }
  return actionLabels[job.action];
};

// const formatDateTime = (value?: string): [string, string] => {
//   if (!value) return ['-', ''];
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return [value, ''];
//   return [date.toLocaleDateString('ru-RU'), date.toLocaleTimeString('ru-RU', {
//     hour: '2-digit',
//     minute: '2-digit',
//   })];
// };

const formatRelativeDateTime = (value?: string): [string, string] => {
  if (!value) return ['-', ''];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [value, ''];
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
  const dayLabel =
    diffDays === -1 ? 'Вчера' : diffDays === 0 ? 'Сегодня' : diffDays === 1 ? 'Завтра' : undefined;
  return [
    dayLabel ?? date.toLocaleDateString('ru-RU'),
    date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  ];
};

const accordionSx = {
  boxShadow: 'none',
  border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
  '&:before': {
    display: 'none',
  },
  '&.MuiAccordion-root': {
    margin: 0,
  },
  '&.MuiAccordion-root + .MuiAccordion-root': {
    marginTop: '-1px',
  },
  '&.Mui-expanded': {
    margin: 0,
  },
  '& .MuiAccordionSummary-root': {
    minHeight: 40,
  },
  '& .MuiAccordionSummary-content': {
    my: 1,
  },
};

// const getScheduleDescription = (job: PlayerSchedulerJob): string => {
//   if (job.kind === 'once')
//     return job.runAt ? `Один раз: ${formatDateTime(job.runAt).join(' ')}` : '';
//   return job.cron ? `${describeCron(job.cron)} (${cronToString(job.cron)})` : '';
// };

type CronPartEditorProps = {
  title: string;
  value: CronPart;
  min: number;
  max: number;
  stepLabel: string;
  selectLabel: string;
  allLabel: string;
  everyLabel: string;
  columns?: number;
  onChange: (value: CronPart) => void;
};

const CronPartEditor: React.FC<CronPartEditorProps> = ({
  title,
  value,
  min,
  max,
  stepLabel,
  selectLabel,
  allLabel,
  everyLabel,
  columns = 10,
  onChange,
}) => {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const toggle = (item: number) => {
    const selected = value.selected.includes(item)
      ? value.selected.filter(current => current !== item)
      : [...value.selected, item];
    onChange({ ...value, selected: normalizeSelected(selected) });
  };
  return (
    <Accordion disableGutters square sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" sx={{ width: 1, pr: 2, justifyContent: 'space-between' }}>
          <Typography>{title}</Typography>
          <Typography color="text.secondary">{partToCron(value)}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <TabContext value={value.mode}>
          <TabList onChange={(_, next: CronMode) => onChange({ ...value, mode: next })}>
            <Tab label={allLabel} value="all" sx={{ textTransform: 'none' }} />
            <Tab label={everyLabel} value="every" sx={{ textTransform: 'none' }} />
            <Tab label={selectLabel} value="select" sx={{ textTransform: 'none' }} />
          </TabList>
          <TabPanel value="all" sx={{ px: 0 }}>
            <Typography variant="body2">*</Typography>
          </TabPanel>
          <TabPanel value="every" sx={{ px: 0 }}>
            <Stack spacing={1}>
              <Typography variant="body2">
                {stepLabel}: {value.every}
              </Typography>
              <Slider
                min={1}
                max={max}
                value={value.every}
                valueLabelDisplay="auto"
                onChange={(_, next) =>
                  onChange({ ...value, every: Array.isArray(next) ? next[0] : next })
                }
              />
            </Stack>
          </TabPanel>
          <TabPanel value="select" sx={{ px: 0 }}>
            <Grid container columns={columns} spacing={0.5}>
              {values.map(item => (
                <Grid size={1} key={item}>
                  <Button
                    fullWidth
                    size="small"
                    variant={value.selected.includes(item) ? 'contained' : 'outlined'}
                    onClick={() => toggle(item)}
                    sx={{ minWidth: 0 }}
                  >
                    {item}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </TabContext>
      </AccordionDetails>
    </Accordion>
  );
};

type SimpleCronPartEditorProps = {
  title: string;
  value: SimpleCronPart;
  min: number;
  max: number;
  allLabel: string;
  selectLabel: string;
  columns?: number;
  formatValue?: (value: number) => React.ReactNode;
  onChange: (value: SimpleCronPart) => void;
};

const SimpleCronPartEditor: React.FC<SimpleCronPartEditorProps> = ({
  title,
  value,
  min,
  max,
  allLabel,
  selectLabel,
  columns = 7,
  formatValue = item => item,
  onChange,
}) => {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const toggle = (item: number) => {
    const selected = value.selected.includes(item)
      ? value.selected.filter(current => current !== item)
      : [...value.selected, item];
    onChange({ ...value, selected: normalizeSelected(selected) });
  };
  return (
    <Accordion disableGutters square sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" sx={{ width: 1, pr: 2, justifyContent: 'space-between' }}>
          <Typography>{title}</Typography>
          <Typography color="text.secondary">{simplePartToCron(value)}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <TabContext value={value.mode}>
          <TabList onChange={(_, next: SimpleCronMode) => onChange({ ...value, mode: next })}>
            <Tab label={allLabel} value="all" />
            <Tab label={selectLabel} value="select" />
          </TabList>
          <TabPanel value="all" sx={{ px: 0 }}>
            <Typography variant="body2">*</Typography>
          </TabPanel>
          <TabPanel value="select" sx={{ px: 0 }}>
            <Grid container columns={columns} spacing={0.5}>
              {values.map(item => (
                <Grid size={1} key={item}>
                  <Button
                    fullWidth
                    size="small"
                    variant={value.selected.includes(item) ? 'contained' : 'outlined'}
                    onClick={() => toggle(item)}
                    sx={{ minWidth: 0 }}
                  >
                    {formatValue(item)}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </TabContext>
      </AccordionDetails>
    </Accordion>
  );
};

type SchedulerDialogProps = {
  kind: ScheduleKind;
  open: boolean;
  playlists: Playlist[];
  initialJob?: PlayerSchedulerJob;
  onClose: () => void;
  onSubmit: (values: DialogValues) => void;
};

const createInitialValues = (
  kind: ScheduleKind,
  initialJob?: PlayerSchedulerJob,
): DialogValues => ({
  id: initialJob?.id,
  playerId: sourceId,
  kind: initialJob?.kind ?? kind,
  name: initialJob?.name ?? '',
  action: initialJob?.action ?? 'play',
  playlistId: initialJob?.playlistId,
  itemNumber: initialJob?.itemNumber,
  hideOutputOnStop: initialJob?.hideOutputOnStop ?? false,
  outputAll: initialJob?.outputAll ?? false,
  runAt: initialJob?.runAt ?? toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
  cron: initialJob?.cron ?? defaultCron(),
  enabled: initialJob?.enabled ?? true,
});

const toJobInput = (job: PlayerSchedulerJob): PlayerSchedulerJobInput => ({
  id: job.id,
  playerId: job.playerId,
  kind: job.kind,
  name: job.name,
  action: job.action,
  playlistId: job.playlistId,
  itemNumber: job.itemNumber,
  hideOutputOnStop: job.hideOutputOnStop,
  outputAll: job.outputAll,
  runAt: job.runAt,
  cron: job.cron,
  enabled: job.enabled,
});

const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const monthNames = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

const SchedulerDialog: React.FC<SchedulerDialogProps> = ({
  kind,
  open,
  playlists,
  initialJob,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = React.useState<DialogValues>(() =>
    createInitialValues(kind, initialJob),
  );

  React.useEffect(() => {
    if (open) setValues(createInitialValues(kind, initialJob));
  }, [initialJob, kind, open]);

  const generatedName = getActionName(values, playlists);
  const name = values.name || generatedName;
  const needsPlaylist = values.action === 'load-playlist';
  const needsItemNumber = values.action === 'play-item';
  const canHideOutputOnStop = values.action === 'stop';
  const canSelectAllOutputs = values.action === 'hide-output' || values.action === 'show-output';
  const isValid =
    name.trim().length > 0 &&
    (!needsPlaylist || values.playlistId != null) &&
    (!needsItemNumber || (values.itemNumber ?? 0) > 0) &&
    (values.kind === 'cron' || Boolean(values.runAt));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {initialJob
          ? 'Редактировать задание'
          : values.kind === 'once'
            ? 'Одиночное действие'
            : 'Повторяющееся действие'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth variant="standard">
            <InputLabel id="scheduler-action-label">Действие</InputLabel>
            <Select<PlayerSchedulerAction>
              labelId="scheduler-action-label"
              value={values.action}
              onChange={event => {
                const action = event.target.value;
                setValues(current => ({
                  ...current,
                  action,
                  name: '',
                  playlistId: action === 'load-playlist' ? current.playlistId : undefined,
                  itemNumber: action === 'play-item' ? (current.itemNumber ?? 1) : undefined,
                  hideOutputOnStop:
                    action === 'stop' ? (current.hideOutputOnStop ?? false) : undefined,
                  outputAll:
                    action === 'hide-output' || action === 'show-output'
                      ? (current.outputAll ?? false)
                      : undefined,
                }));
              }}
            >
              {Object.entries(actionLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {needsPlaylist && (
            <FormControl fullWidth variant="standard">
              <InputLabel id="scheduler-playlist-label">Плейлист</InputLabel>
              <Select
                labelId="scheduler-playlist-label"
                value={values.playlistId ?? ''}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    playlistId: Number(event.target.value),
                    name: '',
                  }))
                }
              >
                {playlists.map(playlist => (
                  <MenuItem key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {needsItemNumber && (
            <TextField
              label="Номер ролика"
              type="number"
              variant="standard"
              fullWidth
              value={values.itemNumber ?? 1}
              slotProps={{ htmlInput: { min: 1 } }}
              onChange={event =>
                setValues(current => ({
                  ...current,
                  itemNumber: Math.max(1, Number(event.target.value) || 1),
                  name: '',
                }))
              }
            />
          )}
          {canHideOutputOnStop && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(values.hideOutputOnStop)}
                  onChange={event =>
                    setValues(current => ({
                      ...current,
                      hideOutputOnStop: event.target.checked,
                      name: '',
                    }))
                  }
                />
              }
              label="Скрыть окно вывода"
            />
          )}
          {canSelectAllOutputs && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(values.outputAll)}
                  onChange={event =>
                    setValues(current => ({
                      ...current,
                      outputAll: event.target.checked,
                      name: '',
                    }))
                  }
                />
              }
              label="Все"
            />
          )}
          <TextField
            label="Название задания"
            variant="standard"
            fullWidth
            placeholder={generatedName}
            value={values.name}
            onChange={event => setValues(current => ({ ...current, name: event.target.value }))}
          />
          {values.kind === 'once' ? (
            <TextField
              label="Время запуска"
              type="datetime-local"
              variant="standard"
              fullWidth
              value={values.runAt}
              onChange={event => setValues(current => ({ ...current, runAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          ) : (
            values.cron && (
              <Stack>
                <CronPartEditor
                  title="Минуты"
                  value={values.cron.minutes}
                  min={0}
                  max={59}
                  stepLabel="Интервал, минут"
                  allLabel="Каждую минуту"
                  everyLabel={`Каждые ${values.cron?.minutes?.every ?? 'N'}-мин`}
                  selectLabel="Выбрать"
                  onChange={minutes =>
                    setValues(current => ({
                      ...current,
                      cron: { ...(current.cron ?? defaultCron()), minutes },
                    }))
                  }
                />
                <CronPartEditor
                  title="Часы"
                  value={values.cron.hours}
                  min={0}
                  max={23}
                  stepLabel="Интервал, часов"
                  allLabel="Каждый час"
                  everyLabel={`Каждые ${values.cron?.hours?.every ?? 'N'}-час`}
                  selectLabel="Выбрать"
                  columns={8}
                  onChange={hours =>
                    setValues(current => ({
                      ...current,
                      cron: { ...(current.cron ?? defaultCron()), hours },
                    }))
                  }
                />
                <SimpleCronPartEditor
                  title="Дни"
                  value={values.cron.days}
                  min={1}
                  max={31}
                  allLabel="Каждый день"
                  selectLabel="Выбрать"
                  onChange={days =>
                    setValues(current => ({
                      ...current,
                      cron: { ...(current.cron ?? defaultCron()), days },
                    }))
                  }
                />
                <SimpleCronPartEditor
                  title="Месяцы"
                  value={values.cron.months}
                  min={1}
                  max={12}
                  allLabel="Каждый месяц"
                  selectLabel="Выбрать"
                  columns={6}
                  formatValue={value => monthNames[value - 1]}
                  onChange={months =>
                    setValues(current => ({
                      ...current,
                      cron: { ...(current.cron ?? defaultCron()), months },
                    }))
                  }
                />
                <SimpleCronPartEditor
                  title="Дни недели"
                  value={values.cron.weekdays}
                  min={0}
                  max={6}
                  allLabel="Каждый день недели"
                  selectLabel="Выбрать"
                  columns={7}
                  formatValue={value => weekdayNames[value]}
                  onChange={weekdays =>
                    setValues(current => ({
                      ...current,
                      cron: { ...(current.cron ?? defaultCron()), weekdays },
                    }))
                  }
                />
                <Typography variant="body2" color="text.secondary">
                  {describeCron(values.cron)} ({cronToString(values.cron)})
                </Typography>
              </Stack>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          disabled={!isValid}
          onClick={() =>
            onSubmit({
              ...values,
              name: name.trim(),
              hideOutputOnStop: values.action === 'stop' ? values.hideOutputOnStop : undefined,
              outputAll: canSelectAllOutputs ? values.outputAll : undefined,
              cron: values.kind === 'cron' ? values.cron : undefined,
              runAt: values.kind === 'once' ? values.runAt : undefined,
            })
          }
        >
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const StatusIcon: React.FC<{ job: PlayerSchedulerJob }> = ({ job }) => {
  if (job.lastStatus === 'success') return <CheckCircleIcon color="success" />;
  if (job.lastStatus === 'error') return <ErrorIcon color="error" />;
  return <RadioButtonUncheckedIcon color={job.enabled ? 'info' : 'disabled'} />;
};

const HoverTableRow = styled(TableRow)({
  '& .MuiIconButton-root': { opacity: 0 },
  '&:hover .MuiIconButton-root': { opacity: 1 },
});

const stopPropagation = (event: React.MouseEvent): void => {
  event.stopPropagation();
};
const disabledRow = {
  opacity: 0.5,
} as const;

const SchedulerTab: React.FC = () => {
  const { data: playlists = [] } = useGetPlaylists();
  const { data: jobs = [] } = useGetSchedulerJobsQuery(sourceId, {
    pollingInterval: 30000,
  });
  const [createJob] = useCreateSchedulerJobMutation();
  const [updateJob] = useUpdateSchedulerJobMutation();
  const [runJob, { isLoading: isRunPending }] = useRunSchedulerJobMutation();
  const [deleteJob] = useDeleteSchedulerJobMutation();
  const [dialogKind, setDialogKind] = React.useState<ScheduleKind | null>(null);
  const [editingJob, setEditingJob] = React.useState<PlayerSchedulerJob | undefined>();

  const openEdit = (job: PlayerSchedulerJob): void => {
    setEditingJob(job);
    setDialogKind(job.kind);
  };

  const closeDialog = (): void => {
    setDialogKind(null);
    setEditingJob(undefined);
  };

  const submitJob = (values: DialogValues): void => {
    if (editingJob) void updateJob({ id: editingJob.id, job: values });
    else void createJob(values);
    closeDialog();
  };

  return (
    <Container
      maxWidth="md"
      disableGutters
      sx={{ height: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Toolbar>
        <Tooltip title="Добавить одиночное действие">
          <Button
            color="inherit"
            startIcon={<AddAlarmIcon />}
            onClick={() => setDialogKind('once')}
          >
            Одиночное
          </Button>
        </Tooltip>
        <Tooltip title="Добавить повторяющееся действие">
          <Button
            color="inherit"
            startIcon={<EventRepeatIcon />}
            onClick={() => setDialogKind('cron')}
          >
            Повторяющееся
          </Button>
        </Tooltip>
      </Toolbar>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {jobs.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            Нет запланированных заданий.
          </Typography>
        ) : (
          <Table
            stickyHeader
            size="small"
            sx={{
              tableLayout: 'fixed',
              width: '100%',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 100 }} align="center">
                  Вкл/выкл
                </TableCell>
                <TableCell>Имя</TableCell>
                <TableCell sx={{ width: 150 }} align="center">
                  Было
                </TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Статус
                </TableCell>
                <TableCell sx={{ width: 150 }} align="center">
                  Далее
                </TableCell>
                <TableCell sx={{ width: 60 }} />
                <TableCell sx={{ width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map(job => {
                const [lastDate, lastTime] = formatRelativeDateTime(job.lastRunAt);
                const [nextDate, nextTime] = formatRelativeDateTime(job.nextRunAt);
                return (
                  <HoverTableRow
                    key={job.id}
                    hover
                    selected={editingJob?.id === job.id}
                    onClick={() => openEdit(job)}
                    sx={job.enabled ? { cursor: 'pointer' } : disabledRow}
                  >
                    <TableCell onClick={stopPropagation} align="center">
                      <Checkbox
                        checked={job.enabled}
                        onChange={() =>
                          void updateJob({
                            id: job.id,
                            job: { ...toJobInput(job), enabled: !job.enabled },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ width: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Typography variant="body2">{job.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {job.action}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{lastDate}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lastTime}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={job.lastMessage ?? (job.enabled ? 'Ожидает' : 'Отключено')}>
                        <span>
                          <StatusIcon job={job} />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{nextDate}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {nextTime}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={stopPropagation}>
                      <Tooltip
                        title={
                          job.enabled ? 'Запустить сейчас' : 'Включите задание, чтобы запустить'
                        }
                      >
                        <div>
                          <IconButton
                            edge="end"
                            disabled={!job.enabled || isRunPending}
                            onClick={() => void runJob(job.id)}
                          >
                            <PlayArrowIcon />
                          </IconButton>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" onClick={stopPropagation}>
                      <Tooltip title="Удалить задание">
                        <IconButton edge="end" onClick={() => void deleteJob(job.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </HoverTableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>
      {dialogKind && (
        <SchedulerDialog
          kind={dialogKind}
          open
          playlists={playlists}
          initialJob={editingJob}
          onClose={closeDialog}
          onSubmit={submitJob}
        />
      )}
    </Container>
  );
};

SchedulerTab.displayName = 'SchedulerTab';

export default SchedulerTab;
