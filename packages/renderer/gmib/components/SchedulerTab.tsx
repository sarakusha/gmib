import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { IconButton, Tooltip } from '@mui/material';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import React from 'react';

import type { Page } from '/@common/config';
import type {
  GmibSchedulerAction,
  GmibSchedulerJob,
  GmibSchedulerJobInput,
  ScheduleKind,
} from '/@common/scheduler';
import { defaultCron } from '/@common/scheduler';
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
import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import { selectCurrentTab, selectSessionVersion } from '../store/selectors';

import SchedulerTabCommon, { type SchedulerTabLabels } from '../../common/SchedulerTab';

import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession } from '/@common/remote';

type DialogValues = GmibSchedulerJobInput;

const labels: SchedulerTabLabels = {
  addOnceButton: 'Одиночное',
  addCronButton: 'Повторяющееся',
  addOnceTooltip: 'Добавить одиночное действие',
  addCronTooltip: 'Добавить повторяющееся действие',
  dialogEditTitle: 'Редактировать задание',
  dialogOnceTitle: 'Одиночное действие',
  dialogCronTitle: 'Повторяющееся действие',
  emptyState: 'Нет запланированных заданий.',
  runNowTooltip: 'Запустить сейчас',
  deleteTooltip: 'Удалить задание',
  enabledHeader: 'Включено',
  nameHeader: 'Имя',
  lastRunHeader: 'Было',
  statusHeader: 'Статус',
  nextRunHeader: 'Далее',
};

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

const createInitialValues = (kind: ScheduleKind, initialJob?: GmibSchedulerJob): DialogValues => ({
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

const toJobInput = (job: GmibSchedulerJob): DialogValues => ({
  id: job.id,
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

const getActionName = (
  job: Pick<DialogValues, 'action' | 'screenId' | 'testId' | 'brightness' | 'enabledValue'>,
  related: { screens: Screen[]; pages: Page[] },
): string => {
  if (job.action === 'show-test') {
    const screen = related.screens.find(item => item.id === job.screenId);
    const page = related.pages.find(item => item.id === job.testId);
    return `Включить тест${page ? ` "${page.title}"` : ''}${screen ? `: ${screen.name}` : ''}`;
  }
  if (job.action === 'hide-test') {
    const screen = related.screens.find(item => item.id === job.screenId);
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

const normalizeActionChange = (
  current: DialogValues,
  nextAction: GmibSchedulerAction,
): DialogValues => ({
  ...current,
  action: nextAction,
  screenId: nextAction === 'show-test' || nextAction === 'hide-test' ? current.screenId : undefined,
  testId: nextAction === 'show-test' ? current.testId : undefined,
  brightness: nextAction === 'set-brightness' ? (current.brightness ?? 50) : undefined,
  enabledValue:
    nextAction === 'set-autobrightness' || nextAction === 'set-overheat-protection'
      ? (current.enabledValue ?? true)
      : undefined,
});

const renderActionFields = ({
  values,
  setValues,
  related,
}: {
  values: DialogValues;
  setValues: React.Dispatch<React.SetStateAction<DialogValues>>;
  kind: ScheduleKind;
  related: { screens: Screen[]; pages: Page[] };
}): React.ReactNode => {
  const needsScreen = values.action === 'show-test' || values.action === 'hide-test';
  const needsTest = values.action === 'show-test';
  const needsBrightness = values.action === 'set-brightness';
  const needsEnabled =
    values.action === 'set-autobrightness' || values.action === 'set-overheat-protection';

  return (
    <>
      {needsScreen && (
        <FormControl fullWidth variant="standard">
          <InputLabel id="gmib-scheduler-screen-label">Экран</InputLabel>
          <Select
            labelId="gmib-scheduler-screen-label"
            value={values.screenId ?? ''}
            onChange={(event: SelectChangeEvent<number | string>) =>
              setValues(current => ({
                ...current,
                screenId: Number(event.target.value),
              }))
            }
          >
            {related.screens.map(screen => (
              <MenuItem key={screen.id} value={screen.id}>
                {screen.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {needsTest && (
        <FormControl fullWidth variant="standard">
          <InputLabel id="gmib-scheduler-test-label">Тест</InputLabel>
          <Select
            labelId="gmib-scheduler-test-label"
            value={values.testId ?? ''}
            onChange={(event: SelectChangeEvent<string>) =>
              setValues(current => ({
                ...current,
                testId: event.target.value,
              }))
            }
          >
            {related.pages.map(page => (
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
          variant="standard"
          value={values.brightness ?? 50}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setValues(current => ({
              ...current,
              brightness: Math.max(Math.min(Number(event.target.value), 100), 0),
            }))
          }
          slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
          fullWidth
        />
      )}
      {needsEnabled && (
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(values.enabledValue)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setValues(current => ({
                  ...current,
                  enabledValue: event.target.checked,
                }))
              }
            />
          }
          label={values.enabledValue ? 'Включить' : 'Отключить'}
        />
      )}
    </>
  );
};

const isSubmitEnabled = (values: DialogValues): boolean => {
  const needsScreen = values.action === 'show-test' || values.action === 'hide-test';
  const needsTest = values.action === 'show-test';
  const needsBrightness = values.action === 'set-brightness';
  return (
    (!needsScreen || values.screenId != null) &&
    (!needsTest || Boolean(values.testId)) &&
    (!needsBrightness || typeof values.brightness === 'number') &&
    (values.kind === 'cron' || Boolean(values.runAt))
  );
};

const StatusIcon: React.FC<{ job: GmibSchedulerJob }> = ({ job }) => {
  if (job.lastStatus === 'success') return <CheckCircleIcon color="success" fontSize="small" />;
  if (job.lastStatus === 'error') return <ErrorIcon color="error" fontSize="small" />;
  return <RadioButtonUncheckedIcon color={job.enabled ? 'info' : 'disabled'} fontSize="small" />;
};

const SchedulerTab: React.FC = () => {
  const version = useSelector(selectSessionVersion);
  const isSchedulerSupported = supportsFeature('gmibScheduler', version, isRemoteSession);
  const { data: jobs = [] } = useGetSchedulerJobsQuery(undefined, {
    skip: !isSchedulerSupported,
  });
  const { screens = [] } = useScreens();
  const { pages = [] } = usePages();
  const [createJob] = useCreateSchedulerJobMutation();
  const [updateJob] = useUpdateSchedulerJobMutation();
  const [runJob, { isLoading: isRunPending }] = useRunSchedulerJobMutation();
  const [deleteJob] = useDeleteSchedulerJobMutation();
  const filteredPages = pages.filter(page => !page.hidden);
  const [dialogKind, setDialogKind] = React.useState<ScheduleKind | null>(null);
  const [editingJob, setEditingJob] = React.useState<GmibSchedulerJob | undefined>();
  const tab = useSelector(selectCurrentTab);
  const [, setToolbar] = useToolbar();

  const toolbar = React.useMemo(
    () => (
      <>
        <Tooltip title={labels.addOnceTooltip}>
          <IconButton
            color="inherit"
            onClick={() => {
              setEditingJob(undefined);
              setDialogKind('once');
            }}
            size="large"
          >
            <AddAlarmIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={labels.addCronTooltip}>
          <IconButton
            color="inherit"
            onClick={() => {
              setEditingJob(undefined);
              setDialogKind('cron');
            }}
            size="large"
          >
            <EventRepeatIcon />
          </IconButton>
        </Tooltip>
      </>
    ),
    [],
  );

  React.useEffect(() => {
    if (tab === 'scheduler') {
      setToolbar(toolbar);
      return () => setToolbar(null);
    }
    return undefined;
  }, [setToolbar, tab, toolbar]);

  const openEdit = (job: GmibSchedulerJob): void => {
    setEditingJob(job);
    setDialogKind(job.kind);
  };

  const closeDialog = (): void => {
    setDialogKind(null);
    setEditingJob(undefined);
  };

  if (!isSchedulerSupported) return null;

  return (
    <SchedulerTabCommon<
      GmibSchedulerJob,
      DialogValues,
      GmibSchedulerAction,
      { screens: Screen[]; pages: Page[] }
    >
      jobs={jobs}
      related={{ screens, pages: filteredPages }}
      actionLabels={actionLabels}
      labels={labels}
      maxWidth="md"
      isRunPending={isRunPending}
      dialogKind={dialogKind}
      editingJob={editingJob}
      createInitialValues={createInitialValues}
      toJobInput={toJobInput}
      normalizeActionChange={normalizeActionChange}
      getActionName={getActionName}
      renderActionFields={renderActionFields}
      isSubmitEnabled={isSubmitEnabled}
      onCreate={async job => {
        await createJob(job).unwrap();
      }}
      onUpdate={async (id, job) => {
        await updateJob({ id, job }).unwrap();
      }}
      onEditJob={openEdit}
      onCloseDialog={closeDialog}
      onDelete={async id => {
        await deleteJob(id).unwrap();
      }}
      onRun={async id => {
        await runJob(id).unwrap();
      }}
      renderStatusIcon={job => <StatusIcon job={job} />}
      getStatusTooltip={job => job.lastMessage ?? (job.enabled ? 'Ожидает' : 'Отключено')}
      getRunTooltip={job =>
        job.enabled ? 'Запустить сейчас' : 'Включите задание, чтобы запустить'
      }
    />
  );
};

SchedulerTab.displayName = 'SchedulerTab';

export default SchedulerTab;
