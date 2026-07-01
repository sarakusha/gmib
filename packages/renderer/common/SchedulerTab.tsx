'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Checkbox from '@mui/material/Checkbox';
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
import { styled } from '@mui/material/styles';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import React from 'react';

import type {
  CronMode,
  CronPart,
  CronSchedule,
  ScheduleKind,
  SchedulerJobBase,
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

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;

export const formatRelativeDateTime = (value?: string): [string, string] => {
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

const CronPartEditor: React.FC<{
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
}> = ({
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

const SimpleCronPartEditor: React.FC<{
  title: string;
  value: SimpleCronPart;
  min: number;
  max: number;
  allLabel: string;
  selectLabel: string;
  columns?: number;
  formatValue?: (value: number) => React.ReactNode;
  onChange: (value: SimpleCronPart) => void;
}> = ({
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

const HoverTableRow = styled(TableRow)({
  '& .MuiIconButton-root': { opacity: 0 },
  '&:hover .MuiIconButton-root': { opacity: 1 },
});

const stopPropagation = (event: React.MouseEvent): void => {
  event.stopPropagation();
};

export type SchedulerDialogValues = {
  kind: ScheduleKind;
  name: string;
  action: string;
  runAt?: string;
  cron?: CronSchedule;
  enabled: boolean;
};

export type SchedulerTabLabels = {
  addOnceButton: string;
  addCronButton: string;
  addOnceTooltip: string;
  addCronTooltip: string;
  dialogEditTitle: string;
  dialogOnceTitle: string;
  dialogCronTitle: string;
  emptyState: string;
  runNowTooltip: string;
  deleteTooltip: string;
  enabledHeader: string;
  nameHeader: string;
  lastRunHeader: string;
  statusHeader: string;
  nextRunHeader: string;
};

export type SchedulerTabProps<
  TJob extends SchedulerJobBase,
  TValues extends SchedulerDialogValues,
  TAction extends string,
  TRelated,
> = {
  toolbar?: React.ReactNode;
  jobs: TJob[];
  related: TRelated;
  actionLabels: Record<TAction, string>;
  labels: SchedulerTabLabels;
  maxWidth?: 'sm' | 'md' | 'lg';
  isRunPending: boolean;
  dialogKind: ScheduleKind | null;
  editingJob?: TJob;
  createInitialValues: (kind: ScheduleKind, initialJob?: TJob) => TValues;
  toJobInput: (job: TJob) => TValues;
  normalizeActionChange: (current: TValues, nextAction: TAction) => TValues;
  getActionName: (job: TValues | TJob, related: TRelated) => string;
  renderActionFields: (args: {
    values: TValues;
    setValues: React.Dispatch<React.SetStateAction<TValues>>;
    kind: ScheduleKind;
    related: TRelated;
  }) => React.ReactNode;
  isSubmitEnabled: (values: TValues) => boolean;
  onCreate: (job: TValues) => Promise<void>;
  onUpdate: (id: string, job: TValues) => Promise<void>;
  onEditJob: (job: TJob) => void;
  onCloseDialog: () => void;
  onDelete: (id: string) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  renderStatusIcon: (job: TJob) => React.ReactNode;
  getStatusTooltip?: (job: TJob) => string;
  getRunTooltip?: (job: TJob) => string;
};

const SchedulerDialog = <
  TJob extends SchedulerJobBase,
  TValues extends SchedulerDialogValues,
  TAction extends string,
  TRelated,
>({
  open,
  kind,
  initialJob,
  labels,
  actionLabels,
  related,
  createInitialValues,
  normalizeActionChange,
  getActionName,
  renderActionFields,
  isSubmitEnabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: ScheduleKind;
  initialJob?: TJob;
  labels: SchedulerTabLabels;
  actionLabels: Record<TAction, string>;
  related: TRelated;
  createInitialValues: (kind: ScheduleKind, initialJob?: TJob) => TValues;
  normalizeActionChange: (current: TValues, nextAction: TAction) => TValues;
  getActionName: (job: TValues | TJob, related: TRelated) => string;
  renderActionFields: (args: {
    values: TValues;
    setValues: React.Dispatch<React.SetStateAction<TValues>>;
    kind: ScheduleKind;
    related: TRelated;
  }) => React.ReactNode;
  isSubmitEnabled: (values: TValues) => boolean;
  onClose: () => void;
  onSubmit: (job: TValues) => Promise<void>;
}) => {
  const [values, setValues] = React.useState<TValues>(() => createInitialValues(kind, initialJob));

  React.useEffect(() => {
    const next = createInitialValues(kind, initialJob);
    if (open) setValues(next);
  }, [createInitialValues, initialJob, kind, open]);

  const title = initialJob
    ? labels.dialogEditTitle
    : kind === 'once'
      ? labels.dialogOnceTitle
      : labels.dialogCronTitle;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth variant="standard">
            <InputLabel id="scheduler-action-label">Действие</InputLabel>
            <Select
              labelId="scheduler-action-label"
              value={values.action}
              onChange={event =>
                setValues(current => normalizeActionChange(current, event.target.value as TAction))
              }
            >
              {(Object.entries(actionLabels) as Array<[TAction, string]>).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {renderActionFields({ values, setValues, kind, related })}
          <TextField
            label="Название задания"
            variant="standard"
            fullWidth
            placeholder={getActionName(values, related)}
            value={values.name}
            onChange={event => setValues(current => ({ ...current, name: event.target.value }))}
          />
          {values.kind === 'once' ? (
            <TextField
              label="Время запуска"
              type="datetime-local"
              variant="standard"
              fullWidth
              value={values.runAt ?? toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000))}
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
                  everyLabel={`Каждые ${values.cron.minutes.every}-мин`}
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
                  everyLabel={`Каждые ${values.cron.hours.every}-час`}
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
                  formatValue={value =>
                    [
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
                    ][value - 1]
                  }
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
                  formatValue={value => ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][value]}
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
          <FormControlLabel
            control={
              <Checkbox
                checked={values.enabled}
                onChange={event =>
                  setValues(current => ({ ...current, enabled: event.target.checked }))
                }
              />
            }
            label={values.enabled ? 'Включено' : 'Отключено'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          disabled={!isSubmitEnabled(values)}
          onClick={() => {
            void onSubmit({
              ...values,
              name: values.name.trim() || getActionName(values, related),
              cron: values.kind === 'cron' ? values.cron : undefined,
              runAt: values.kind === 'once' ? values.runAt : undefined,
            });
          }}
        >
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SchedulerTab = <
  TJob extends SchedulerJobBase,
  TValues extends SchedulerDialogValues,
  TAction extends string,
  TRelated,
>({
  jobs,
  related,
  actionLabels,
  labels,
  maxWidth = 'md',
  toolbar,
  isRunPending,
  dialogKind,
  editingJob,
  createInitialValues,
  toJobInput,
  normalizeActionChange,
  getActionName,
  renderActionFields,
  isSubmitEnabled,
  onCreate,
  onUpdate,
  onEditJob,
  onCloseDialog,
  onDelete,
  onRun,
  renderStatusIcon,
  getStatusTooltip,
  getRunTooltip,
}: SchedulerTabProps<TJob, TValues, TAction, TRelated>) => {
  const submitJob = async (values: TValues): Promise<void> => {
    if (editingJob) await onUpdate(editingJob.id, values);
    else await onCreate(values);
    onCloseDialog();
  };

  return (
    <Container
      maxWidth={maxWidth}
      disableGutters
      sx={{ height: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {toolbar}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {jobs.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            {labels.emptyState}
          </Typography>
        ) : (
          <Table
            stickyHeader
            size="small"
            padding="none"
            sx={{
              tableLayout: 'fixed',
              width: '100%',
              minWidth: 640,
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 90 }} align="center">
                  {labels.enabledHeader}
                </TableCell>
                <TableCell align="center">{labels.nameHeader}</TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  {labels.lastRunHeader}
                </TableCell>
                <TableCell sx={{ width: 80 }} align="center">
                  {labels.statusHeader}
                </TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  {labels.nextRunHeader}
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
                    onClick={() => onEditJob(job)}
                    sx={job.enabled ? { cursor: 'pointer' } : { opacity: 0.5 }}
                  >
                    <TableCell onClick={stopPropagation} align="center">
                      <Checkbox
                        checked={job.enabled}
                        onChange={() =>
                          void onUpdate(job.id, {
                            ...toJobInput(job),
                            enabled: !job.enabled,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ width: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Typography variant="body2">{job.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {job.action}
                        {/* <br />
                        {job.cron ?? } */}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{lastDate}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lastTime}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={getStatusTooltip?.(job) ?? job.lastMessage ?? ''}>
                        <span>{renderStatusIcon(job)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{nextDate}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {nextTime}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={stopPropagation}>
                      <Tooltip title={getRunTooltip?.(job) ?? labels.runNowTooltip}>
                        <div>
                          <IconButton
                            edge="end"
                            disabled={!job.enabled || isRunPending}
                            onClick={() => void onRun(job.id)}
                          >
                            <PlayArrowIcon />
                          </IconButton>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center" onClick={stopPropagation}>
                      <Tooltip title={labels.deleteTooltip}>
                        <IconButton edge="end" onClick={() => void onDelete(job.id)}>
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
        <SchedulerDialog<TJob, TValues, TAction, TRelated>
          open
          kind={dialogKind}
          initialJob={editingJob}
          labels={labels}
          actionLabels={actionLabels}
          related={related}
          createInitialValues={createInitialValues}
          normalizeActionChange={normalizeActionChange}
          getActionName={getActionName}
          renderActionFields={renderActionFields}
          isSubmitEnabled={isSubmitEnabled}
          onClose={onCloseDialog}
          onSubmit={submitJob}
        />
      )}
    </Container>
  );
};

export default SchedulerTab;
