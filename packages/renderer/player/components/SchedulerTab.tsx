import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import DeleteIcon from '@mui/icons-material/Delete';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  ButtonGroup,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import React from 'react';

import type { Playlist } from '/@common/playlist';

import { usePlayer } from '../api/player';
import { useGetPlaylists } from '../api/playlists';
import updatePlayer, { playerNext } from '../api/updatePlayer';
import { useDispatch } from '../store';
import { setPlaybackState } from '../store/currentSlice';
import { sourceId } from '../utils';

import Toolbar from './StyledToolbar';

type ScheduleKind = 'once' | 'cron';
type PlayerAction = 'load-playlist' | 'play' | 'stop' | 'next' | 'play-item';
type CronMode = 'all' | 'every' | 'select';
type SimpleCronMode = 'all' | 'select';

type CronPart = {
  mode: CronMode;
  every: number;
  selected: number[];
};

type SimpleCronPart = {
  mode: SimpleCronMode;
  selected: number[];
};

type CronSchedule = {
  minutes: CronPart;
  hours: CronPart;
  days: SimpleCronPart;
  months: SimpleCronPart;
  weekdays: SimpleCronPart;
};

type SchedulerJob = {
  id: string;
  kind: ScheduleKind;
  name: string;
  action: PlayerAction;
  playlistId?: number;
  itemNumber?: number;
  runAt?: string;
  cron?: CronSchedule;
  enabled: boolean;
  lastRunKey?: string;
};

type DialogValues = Omit<SchedulerJob, 'id' | 'enabled' | 'lastRunKey'>;

const storageKey = 'gmib.player.scheduler.jobs';

const defaultCron = (): CronSchedule => ({
  minutes: { mode: 'every', every: 10, selected: [] },
  hours: { mode: 'all', every: 1, selected: [] },
  days: { mode: 'all', selected: [] },
  months: { mode: 'all', selected: [] },
  weekdays: { mode: 'all', selected: [] },
});

const actionLabels: Record<PlayerAction, string> = {
  'load-playlist': 'Загрузить и воспроизвести плейлист',
  play: 'Play',
  stop: 'Stop',
  next: 'Next',
  'play-item': 'Запустить ролик по номеру',
};

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;

const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeSelected = (selected: number[]): number[] =>
  Array.from(new Set(selected)).sort((a, b) => a - b);

const partToCron = (part: CronPart): string => {
  if (part.mode === 'all') return '*';
  if (part.mode === 'every') return `*/${part.every}`;
  return normalizeSelected(part.selected).join(',') || '*';
};

const simplePartToCron = (part: SimpleCronPart): string =>
  part.mode === 'all' ? '*' : normalizeSelected(part.selected).join(',') || '*';

const cronToString = (cron: CronSchedule): string =>
  [
    partToCron(cron.minutes),
    partToCron(cron.hours),
    simplePartToCron(cron.days),
    simplePartToCron(cron.months),
    simplePartToCron(cron.weekdays),
  ].join(' ');

const matchesPart = (part: CronPart, value: number): boolean => {
  if (part.mode === 'all') return true;
  if (part.mode === 'every') return value % part.every === 0;
  return part.selected.includes(value);
};

const matchesSimplePart = (part: SimpleCronPart, value: number): boolean =>
  part.mode === 'all' || part.selected.includes(value);

const matchesCron = (cron: CronSchedule, date: Date): boolean =>
  matchesPart(cron.minutes, date.getMinutes()) &&
  matchesPart(cron.hours, date.getHours()) &&
  matchesSimplePart(cron.days, date.getDate()) &&
  matchesSimplePart(cron.months, date.getMonth() + 1) &&
  matchesSimplePart(cron.weekdays, date.getDay());

const getMinuteKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;

const getActionName = (
  job: Pick<SchedulerJob, 'action' | 'playlistId' | 'itemNumber'>,
  playlists: Playlist[],
): string => {
  if (job.action === 'load-playlist') {
    const playlist = playlists.find(item => item.id === job.playlistId);
    return `${actionLabels[job.action]}${playlist ? `: ${playlist.name}` : ''}`;
  }
  if (job.action === 'play-item') {
    return `${actionLabels[job.action]}${job.itemNumber ? ` ${job.itemNumber}` : ''}`;
  }
  return actionLabels[job.action];
};

const describeCron = (cron: CronSchedule): string => {
  const minutes =
    cron.minutes.mode === 'all'
      ? 'каждую минуту'
      : cron.minutes.mode === 'every'
        ? `каждые ${cron.minutes.every} мин.`
        : `в ${normalizeSelected(cron.minutes.selected).join(', ')} мин.`;
  const hours =
    cron.hours.mode === 'all'
      ? 'ежечасно'
      : cron.hours.mode === 'every'
        ? `каждые ${cron.hours.every} ч.`
        : `в ${normalizeSelected(cron.hours.selected).join(', ')} ч.`;
  const days =
    cron.days.mode === 'all'
      ? ''
      : `, дни месяца: ${normalizeSelected(cron.days.selected).join(', ')}`;
  const months =
    cron.months.mode === 'all'
      ? ''
      : `, месяцы: ${normalizeSelected(cron.months.selected).join(', ')}`;
  const weekdays =
    cron.weekdays.mode === 'all'
      ? ''
      : `, дни недели: ${normalizeSelected(cron.weekdays.selected).join(', ')}`;
  return `Повторять ${minutes}, ${hours}${days}${months}${weekdays}`;
};

const readJobs = (): SchedulerJob[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SchedulerJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJobs = (jobs: SchedulerJob[]): void => {
  localStorage.setItem(storageKey, JSON.stringify(jobs));
};

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
  const tab = value.mode;
  const toggle = (item: number) => {
    const selected = value.selected.includes(item)
      ? value.selected.filter(current => current !== item)
      : [...value.selected, item];
    onChange({ ...value, selected: normalizeSelected(selected) });
  };
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" sx={{ width: 1, pr: 2, justifyContent: 'space-between' }}>
          <Typography>{title}</Typography>
          <Typography color="text.secondary">{partToCron(value)}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <TabContext value={tab}>
          <TabList onChange={(_, next: CronMode) => onChange({ ...value, mode: next })}>
            <Tab label={allLabel} value="all" />
            <Tab label={everyLabel} value="every" />
            <Tab label={selectLabel} value="select" />
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
    <Accordion disableGutters>
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

type SchedulerDialogProps = {
  kind: ScheduleKind;
  open: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onSubmit: (values: DialogValues) => void;
};

const SchedulerDialog: React.FC<SchedulerDialogProps> = ({
  kind,
  open,
  playlists,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = React.useState<DialogValues>(() => ({
    kind,
    name: '',
    action: 'play',
    runAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    cron: defaultCron(),
  }));

  React.useEffect(() => {
    if (!open) return;
    setValues({
      kind,
      name: '',
      action: 'play',
      runAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
      cron: defaultCron(),
    });
  }, [kind, open]);

  const generatedName = getActionName(values, playlists);
  const name = values.name || generatedName;
  const needsPlaylist = values.action === 'load-playlist';
  const needsItemNumber = values.action === 'play-item';
  const isValid =
    name.trim().length > 0 &&
    (!needsPlaylist || values.playlistId != null) &&
    (!needsItemNumber || (values.itemNumber ?? 0) > 0) &&
    (kind === 'cron' || Boolean(values.runAt));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{kind === 'once' ? 'Одиночное действие' : 'Повторяющееся действие'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth variant="standard">
            <InputLabel id="scheduler-action-label">Действие</InputLabel>
            <Select<PlayerAction>
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
          <TextField
            label="Название задания"
            variant="standard"
            fullWidth
            placeholder={generatedName}
            value={values.name}
            onChange={event => setValues(current => ({ ...current, name: event.target.value }))}
          />
          {kind === 'once' ? (
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
              <Stack spacing={1}>
                <CronPartEditor
                  title="Минуты"
                  value={values.cron.minutes}
                  min={0}
                  max={59}
                  stepLabel="Интервал, минут"
                  allLabel="Каждую минуту"
                  everyLabel="Каждые n-мин"
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
                  everyLabel="Каждые n-ч"
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
          onClick={() => onSubmit({ ...values, name: name.trim() })}
        >
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SchedulerTab: React.FC = () => {
  const dispatch = useDispatch();
  const { player } = usePlayer(sourceId);
  const { data: playlists = [] } = useGetPlaylists();
  const [jobs, setJobs] = React.useState<SchedulerJob[]>(readJobs);
  const [dialogKind, setDialogKind] = React.useState<ScheduleKind | null>(null);
  const jobsRef = React.useRef(jobs);
  const playerRef = React.useRef(player);
  const playlistsRef = React.useRef(playlists);

  React.useEffect(() => {
    jobsRef.current = jobs;
    writeJobs(jobs);
  }, [jobs]);

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  const runJob = React.useCallback(
    (job: SchedulerJob) => {
      switch (job.action) {
        case 'load-playlist':
          if (job.playlistId == null) return;
          dispatch(
            updatePlayer(sourceId, current => ({
              ...current,
              playlistId: job.playlistId,
              current: undefined,
              autoPlay: true,
            })),
          );
          dispatch(setPlaybackState('playing'));
          break;
        case 'play':
          dispatch(setPlaybackState('playing'));
          break;
        case 'stop':
          dispatch(setPlaybackState('none'));
          break;
        case 'next':
          dispatch(playerNext());
          break;
        case 'play-item': {
          const playlist = playlistsRef.current.find(
            item => item.id === playerRef.current?.playlistId,
          );
          const item = playlist?.items[(job.itemNumber ?? 1) - 1];
          if (!item) return;
          dispatch(
            updatePlayer(sourceId, current => ({
              ...current,
              current: item.id,
              autoPlay: true,
            })),
          );
          dispatch(setPlaybackState('playing'));
          break;
        }
        default:
          break;
      }
    },
    [dispatch],
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const minuteKey = getMinuteKey(now);
      let changed = false;
      const nextJobs = jobsRef.current.map(job => {
        if (!job.enabled) return job;
        if (job.kind === 'once') {
          if (!job.runAt || job.lastRunKey) return job;
          if (new Date(job.runAt).getTime() > now.getTime()) return job;
          runJob(job);
          changed = true;
          return { ...job, enabled: false, lastRunKey: minuteKey };
        }
        if (!job.cron || job.lastRunKey === minuteKey || !matchesCron(job.cron, now)) return job;
        runJob(job);
        changed = true;
        return { ...job, lastRunKey: minuteKey };
      });
      if (changed) setJobs(nextJobs);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [runJob]);

  const submitJob = (values: DialogValues) => {
    setJobs(current => [
      ...current,
      {
        ...values,
        id: createId(),
        enabled: true,
        cron: values.kind === 'cron' ? values.cron : undefined,
        runAt: values.kind === 'once' ? values.runAt : undefined,
      },
    ]);
    setDialogKind(null);
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
            Нет запланированных действий.
          </Typography>
        ) : (
          <List>
            {jobs.map(job => (
              <ListItem key={job.id} divider>
                <ListItemText
                  primary={job.name}
                  secondary={
                    job.kind === 'once'
                      ? `${job.runAt ?? ''}${job.enabled ? '' : ' - выполнено'}`
                      : `${job.cron ? cronToString(job.cron) : ''} - ${
                          job.cron ? describeCron(job.cron) : ''
                        }`
                  }
                />
                <ListItemSecondaryAction>
                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      onClick={() =>
                        setJobs(current =>
                          current.map(item =>
                            item.id === job.id ? { ...item, enabled: !item.enabled } : item,
                          ),
                        )
                      }
                    >
                      {job.enabled ? 'Вкл' : 'Выкл'}
                    </Button>
                    <IconButton
                      edge="end"
                      onClick={() => setJobs(current => current.filter(item => item.id !== job.id))}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ButtonGroup>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      {dialogKind && (
        <SchedulerDialog
          kind={dialogKind}
          open
          playlists={playlists}
          onClose={() => setDialogKind(null)}
          onSubmit={submitJob}
        />
      )}
    </Container>
  );
};

SchedulerTab.displayName = 'SchedulerTab';

export default SchedulerTab;
