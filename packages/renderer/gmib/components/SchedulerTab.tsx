import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorIcon from '@mui/icons-material/Error';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';

import type { Page } from '/@common/config';
import type {
  CronPart,
  CronSchedule,
  GmibSchedulerAction,
  GmibSchedulerJob,
  GmibSchedulerJobInput,
  SimpleCronPart,
} from '/@common/scheduler';
import {
  cronToString,
  defaultCron,
  describeCron,
} from '/@common/scheduler';
import type { Screen } from '/@common/video';

import { usePages } from '../api/config';
import {
  useCreateSchedulerJobMutation,
  useDeleteSchedulerJobMutation,
  useGetSchedulerJobsQuery,
  useRunSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
} from '../api/scheduler';
import { useScreens } from '../api/screens';

type DialogValues = GmibSchedulerJobInput;

const actionLabels: Record<GmibSchedulerAction, string> = {
  'show-test': 'Включить тест',
  'hide-test': 'Отключить тест',
  'set-brightness': 'Задать яркость',
  'set-autobrightness': 'Включить/отключить автояркость',
  'set-overheat-protection': 'Включить/отключить защиту от перегрева',
};

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;

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
    date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  ];
};

const partFromCron = (value: string, min: number, max: number): CronPart => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return { mode: 'all', every: 1, selected: [] };
  if (trimmed.startsWith('*/')) {
    const every = Number(trimmed.slice(2));
    return { mode: 'every', every: Math.max(Math.min(every || 1, max), 1), selected: [] };
  }
  return {
    mode: 'select',
    every: 1,
    selected: trimmed
      .split(',')
      .map(item => Number(item.trim()))
      .filter(item => Number.isInteger(item) && item >= min && item <= max),
  };
};

const simplePartFromCron = (value: string, min: number, max: number): SimpleCronPart => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return { mode: 'all', selected: [] };
  return {
    mode: 'select',
    selected: trimmed
      .split(',')
      .map(item => Number(item.trim()))
      .filter(item => Number.isInteger(item) && item >= min && item <= max),
  };
};

const parseCron = (value: string): CronSchedule => {
  const [minutes = '*', hours = '*', days = '*', months = '*', weekdays = '*'] = value
    .trim()
    .split(/\s+/);
  return {
    minutes: partFromCron(minutes, 0, 59),
    hours: partFromCron(hours, 0, 23),
    days: simplePartFromCron(days, 1, 31),
    months: simplePartFromCron(months, 1, 12),
    weekdays: simplePartFromCron(weekdays, 0, 6),
  };
};

const getActionName = (
  job: Pick<
    GmibSchedulerJobInput,
    'action' | 'screenId' | 'testId' | 'brightness' | 'enabledValue'
  >,
  screens: Screen[],
  pages: Page[],
): string => {
  if (job.action === 'show-test') {
    const screen = screens.find(item => item.id === job.screenId);
    const page = pages.find(item => item.id === job.testId);
    return `Включить тест${page ? ` "${page.title}"` : ''}${screen ? `: ${screen.name}` : ''}`;
  }
  if (job.action === 'hide-test') {
    const screen = screens.find(item => item.id === job.screenId);
    return `Отключить тест${screen ? `: ${screen.name}` : ''}`;
  }
  if (job.action === 'set-brightness') return `Задать яркость ${job.brightness ?? 0}%`;
  if (job.action === 'set-autobrightness') {
    return `${job.enabledValue ? 'Включить' : 'Отключить'} автояркость`;
  }
  if (job.action === 'set-overheat-protection') {
    return `${job.enabledValue ? 'Включить' : 'Отключить'} защиту от перегрева`;
  }
  return actionLabels[job.action];
};

const getScheduleDescription = (job: GmibSchedulerJob): string => {
  if (job.kind === 'once') return job.runAt ? `Один раз: ${formatRelativeDateTime(job.runAt).join(' ')}` : '';
  return job.cron ? `${describeCron(job.cron)} (${cronToString(job.cron)})` : '';
};

const createInitialValues = (kind: DialogValues['kind'], initialJob?: GmibSchedulerJob): DialogValues => ({
  kind,
  name: initialJob?.name ?? '',
  action: initialJob?.action ?? 'show-test',
  screenId: initialJob?.screenId,
  testId: initialJob?.testId,
  brightness: initialJob?.brightness ?? 50,
  enabledValue: initialJob?.enabledValue ?? true,
  runAt: initialJob?.runAt ?? toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
  cron: initialJob?.cron ?? defaultCron(),
  enabled: initialJob?.enabled ?? true,
});

const toJobInput = (job: GmibSchedulerJob): GmibSchedulerJobInput => ({
  kind: job.kind,
  name: job.name,
  action: job.action,
  screenId: job.screenId,
  testId: job.testId,
  brightness: job.brightness,
  enabledValue: job.enabledValue,
  runAt: job.runAt,
  cron: job.cron,
  enabled: job.enabled,
});

const StatusIcon: React.FC<{ job: GmibSchedulerJob }> = ({ job }) => {
  if (job.lastStatus === 'success') return <CheckCircleIcon color="success" fontSize="small" />;
  if (job.lastStatus === 'error') return <ErrorIcon color="error" fontSize="small" />;
  return <RadioButtonUncheckedIcon color="disabled" fontSize="small" />;
};

type SchedulerDialogProps = {
  open: boolean;
  kind: DialogValues['kind'];
  initialJob?: GmibSchedulerJob;
  screens: Screen[];
  pages: Page[];
  onCancel: () => void;
  onSubmit: (job: GmibSchedulerJobInput) => Promise<void>;
};

const SchedulerDialog: React.FC<SchedulerDialogProps> = ({
  open,
  kind,
  initialJob,
  screens,
  pages,
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = React.useState<DialogValues>(() => createInitialValues(kind, initialJob));
  const [cronText, setCronText] = React.useState(() => cronToString(values.cron ?? defaultCron()));

  React.useEffect(() => {
    const next = initialJob ? toJobInput(initialJob) : createInitialValues(kind);
    setValues(next);
    setCronText(cronToString(next.cron ?? defaultCron()));
  }, [initialJob, kind, open]);

  const update = <K extends keyof DialogValues>(key: K, value: DialogValues[K]) => {
    setValues(current => {
      const next = { ...current, [key]: value };
      if (key === 'action') {
        next.screenId = value === 'show-test' || value === 'hide-test' ? current.screenId : undefined;
        next.testId = value === 'show-test' ? current.testId : undefined;
        next.brightness = value === 'set-brightness' ? (current.brightness ?? 50) : undefined;
        next.enabledValue =
          value === 'set-autobrightness' || value === 'set-overheat-protection'
            ? (current.enabledValue ?? true)
            : undefined;
      }
      return next;
    });
  };

  const needsScreen = values.action === 'show-test' || values.action === 'hide-test';
  const needsTest = values.action === 'show-test';
  const needsBrightness = values.action === 'set-brightness';
  const needsEnabled = values.action === 'set-autobrightness' || values.action === 'set-overheat-protection';
  const canSubmit =
    values.name.trim() &&
    (!needsScreen || values.screenId != null) &&
    (!needsTest || values.testId) &&
    (!needsBrightness || typeof values.brightness === 'number') &&
    (values.kind === 'cron' || values.runAt);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{initialJob ? 'Редактировать задание' : 'Добавить задание'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="gmib-scheduler-action-label">Действие</InputLabel>
            <Select<GmibSchedulerAction>
              labelId="gmib-scheduler-action-label"
              label="Действие"
              value={values.action}
              onChange={event => update('action', event.target.value)}
            >
              {Object.entries(actionLabels).map(([action, label]) => (
                <MenuItem key={action} value={action}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {needsScreen && (
            <FormControl fullWidth>
              <InputLabel id="gmib-scheduler-screen-label">Экран</InputLabel>
              <Select
                labelId="gmib-scheduler-screen-label"
                label="Экран"
                value={values.screenId ?? ''}
                onChange={event => update('screenId', Number(event.target.value))}
              >
                {screens.map(screen => (
                  <MenuItem key={screen.id} value={screen.id}>
                    {screen.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {needsTest && (
            <FormControl fullWidth>
              <InputLabel id="gmib-scheduler-test-label">Тест</InputLabel>
              <Select
                labelId="gmib-scheduler-test-label"
                label="Тест"
                value={values.testId ?? ''}
                onChange={event => update('testId', event.target.value)}
              >
                {pages.map(page => (
                  <MenuItem key={page.id} value={page.id}>
                    {page.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {needsBrightness && (
            <TextField
              label="Яркость, %"
              type="number"
              value={values.brightness ?? 50}
              onChange={event => update('brightness', Math.max(Math.min(Number(event.target.value), 100), 0))}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              fullWidth
            />
          )}
          {needsEnabled && (
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(values.enabledValue)}
                  onChange={event => update('enabledValue', event.target.checked)}
                />
              }
              label={values.enabledValue ? 'Включить' : 'Отключить'}
            />
          )}
          <TextField
            label="Название задания"
            value={values.name}
            onChange={event => update('name', event.target.value)}
            onFocus={() => {
              if (!values.name) update('name', getActionName(values, screens, pages));
            }}
            fullWidth
          />
          {kind === 'once' ? (
            <TextField
              label="Время запуска"
              type="datetime-local"
              value={values.runAt}
              onChange={event => update('runAt', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          ) : (
            <TextField
              label="Cron"
              value={cronText}
              helperText="Формат: минуты часы дни месяцы дни-недели, например */10 * * * *"
              onChange={event => {
                setCronText(event.target.value);
                update('cron', parseCron(event.target.value));
              }}
              fullWidth
            />
          )}
          <FormControlLabel
            control={
              <Switch checked={values.enabled} onChange={event => update('enabled', event.target.checked)} />
            }
            label={values.enabled ? 'Включено' : 'Отключено'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Отмена</Button>
        <Button
          disabled={!canSubmit}
          onClick={() => {
            void onSubmit({
              ...values,
              name: values.name.trim() || getActionName(values, screens, pages),
              cron: kind === 'cron' ? parseCron(cronText) : undefined,
              runAt: kind === 'once' ? values.runAt : undefined,
            });
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SchedulerTab: React.FC = () => {
  const { data: jobs = [] } = useGetSchedulerJobsQuery();
  const { screens = [] } = useScreens();
  const { pages = [] } = usePages();
  const [createJob] = useCreateSchedulerJobMutation();
  const [updateJob] = useUpdateSchedulerJobMutation();
  const [runJob, { isLoading: isRunPending }] = useRunSchedulerJobMutation();
  const [deleteJob] = useDeleteSchedulerJobMutation();
  const [dialogKind, setDialogKind] = React.useState<DialogValues['kind'] | undefined>();
  const [editingJob, setEditingJob] = React.useState<GmibSchedulerJob | undefined>();
  const filteredPages = pages.filter(page => !page.hidden);

  const closeDialog = () => {
    setDialogKind(undefined);
    setEditingJob(undefined);
  };

  const submit = async (job: GmibSchedulerJobInput) => {
    if (editingJob) await updateJob({ id: editingJob.id, job }).unwrap();
    else await createJob(job).unwrap();
    closeDialog();
  };

  return (
    <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Button startIcon={<AddAlarmIcon />} onClick={() => setDialogKind('once')}>
          Добавить одиночное действие
        </Button>
        <Button startIcon={<EventRepeatIcon />} onClick={() => setDialogKind('cron')}>
          Добавить повторяющееся действие
        </Button>
      </Toolbar>
      <Container sx={{ flex: 1, overflow: 'auto' }} maxWidth="lg">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Было</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Далее</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">Нет запланированных заданий</Typography>
                </TableCell>
              </TableRow>
            )}
            {jobs.map(job => {
              const [lastDate, lastTime] = formatRelativeDateTime(job.lastRunAt);
              const [nextDate, nextTime] = formatRelativeDateTime(job.nextRunAt);
              return (
                <TableRow key={job.id} hover>
                  <TableCell onClick={() => { setEditingJob(job); setDialogKind(job.kind); }} sx={{ cursor: 'pointer' }}>
                    <Typography>{job.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getActionName(job, screens, filteredPages)}
                      <br />
                      {getScheduleDescription(job)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{lastDate}</Typography>
                    <Typography variant="body2" color="text.secondary">{lastTime}</Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={job.lastMessage ?? ''}>
                      <span><StatusIcon job={job} /></span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography>{nextDate}</Typography>
                    <Typography variant="body2" color="text.secondary">{nextTime}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Запустить сейчас">
                      <span>
                        <IconButton size="small" disabled={isRunPending} onClick={() => void runJob(job.id)}>
                          <PlayArrowIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" onClick={() => void deleteJob(job.id)}>
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Container>
      {dialogKind && (
        <SchedulerDialog
          open
          kind={dialogKind}
          initialJob={editingJob}
          screens={screens}
          pages={filteredPages}
          onCancel={closeDialog}
          onSubmit={submit}
        />
      )}
    </Box>
  );
};

export default SchedulerTab;
