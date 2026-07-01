import React from 'react';

import type { Playlist } from '/@common/playlist';
import type {
  PlayerSchedulerAction,
  PlayerSchedulerJob,
  PlayerSchedulerJobInput,
  ScheduleKind,
} from '/@common/scheduler';
import { cronToString, defaultCron, describeCron } from '/@common/scheduler';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

import Checkbox from '@mui/material/Checkbox';
import {
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';

import { useGetPlaylists } from '../api/playlists';
import {
  useCreateSchedulerJobMutation,
  useDeleteSchedulerJobMutation,
  useGetSchedulerJobsQuery,
  useRunSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
} from '../api/scheduler';
import { sourceId } from '../utils';

import SchedulerTabCommon, {
  formatRelativeDateTime,
  type SchedulerTabLabels,
} from '../../common/SchedulerTab';

type DialogValues = PlayerSchedulerJobInput;

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
  enabledHeader: 'Вкл/выкл',
  nameHeader: 'Имя',
  lastRunHeader: 'Было',
  statusHeader: 'Статус',
  nextRunHeader: 'Далее',
};

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

const toJobInput = (job: PlayerSchedulerJob): DialogValues => ({
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

const getActionName = (
  job: Pick<
    DialogValues,
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

const getScheduleDescription = (job: PlayerSchedulerJob): string => {
  if (job.kind === 'once')
    return job.runAt ? `Один раз: ${formatRelativeDateTime(job.runAt).join(' ')}` : '';
  return job.cron ? `${describeCron(job.cron)} (${cronToString(job.cron)})` : '';
};

const normalizeActionChange = (
  current: DialogValues,
  nextAction: PlayerSchedulerAction,
): DialogValues => ({
  ...current,
  action: nextAction,
  playlistId: nextAction === 'load-playlist' ? current.playlistId : undefined,
  itemNumber: nextAction === 'play-item' ? (current.itemNumber ?? 1) : undefined,
  hideOutputOnStop: nextAction === 'stop' ? (current.hideOutputOnStop ?? false) : undefined,
  outputAll:
    nextAction === 'hide-output' || nextAction === 'show-output'
      ? (current.outputAll ?? false)
      : undefined,
});

const renderActionFields = ({
  values,
  setValues,
  related: playlists,
}: {
  values: DialogValues;
  setValues: React.Dispatch<React.SetStateAction<DialogValues>>;
  kind: ScheduleKind;
  related: Playlist[];
}): React.ReactNode => {
  const needsPlaylist = values.action === 'load-playlist';
  const needsItemNumber = values.action === 'play-item';
  const canHideOutputOnStop = values.action === 'stop';
  const canSelectAllOutputs = values.action === 'hide-output' || values.action === 'show-output';

  return (
    <>
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
    </>
  );
};

const isSubmitEnabled = (values: DialogValues): boolean => {
  const needsPlaylist = values.action === 'load-playlist';
  const needsItemNumber = values.action === 'play-item';
  return (
    (!needsPlaylist || values.playlistId != null) &&
    (!needsItemNumber || (values.itemNumber ?? 0) > 0) &&
    (values.kind === 'cron' || Boolean(values.runAt))
  );
};

const StatusIcon: React.FC<{ job: PlayerSchedulerJob }> = ({ job }) => {
  if (job.lastStatus === 'success') return <CheckCircleIcon color="success" />;
  if (job.lastStatus === 'error') return <ErrorIcon color="error" />;
  return <RadioButtonUncheckedIcon color={job.enabled ? 'info' : 'disabled'} />;
};

const SchedulerTab: React.FC = () => {
  const { data: playlists = [] } = useGetPlaylists();
  const { data: jobs = [] } = useGetSchedulerJobsQuery(sourceId, {
    pollingInterval: 30000,
  });
  const [createJob] = useCreateSchedulerJobMutation();
  const [updateJob] = useUpdateSchedulerJobMutation();
  const [runJob, { isLoading: isRunPending }] = useRunSchedulerJobMutation();
  const [deleteJob] = useDeleteSchedulerJobMutation();

  return (
    <SchedulerTabCommon<PlayerSchedulerJob, DialogValues, PlayerSchedulerAction, Playlist[]>
      jobs={jobs}
      related={playlists}
      actionLabels={actionLabels}
      labels={labels}
      maxWidth="md"
      isRunPending={isRunPending}
      createInitialValues={createInitialValues}
      toJobInput={toJobInput}
      normalizeActionChange={normalizeActionChange}
      getActionName={getActionName}
      getScheduleDescription={getScheduleDescription}
      renderActionFields={renderActionFields}
      isSubmitEnabled={isSubmitEnabled}
      onCreate={async job => {
        await createJob(job).unwrap();
      }}
      onUpdate={async (id, job) => {
        await updateJob({ id, job }).unwrap();
      }}
      onDelete={async id => {
        await deleteJob(id).unwrap();
      }}
      onRun={async id => {
        await runJob(id).unwrap();
      }}
      renderStatusIcon={job => <StatusIcon job={job} />}
      getStatusTooltip={job => job.lastMessage ?? ''}
      getRunTooltip={job =>
        job.enabled ? 'Запустить сейчас' : 'Включите задание, чтобы запустить'
      }
    />
  );
};

SchedulerTab.displayName = 'SchedulerTab';

export default SchedulerTab;
