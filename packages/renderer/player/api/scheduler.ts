import { createApi } from '@reduxjs/toolkit/query/react';

import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';
import type { PlayerSchedulerJob, PlayerSchedulerJobInput } from '/@common/scheduler';

import baseQuery from '../../common/authBaseQuery';

const canUseAction = (action: PlayerSchedulerJobInput['action']): boolean =>
  supportsFeature('playerScheduler', version, isRemoteSession) &&
  (action !== 'play-playlist-times' ||
    supportsFeature('playerPlaylistRepeat', version, isRemoteSession));
const unsupported = () => ({
  error: { status: 404 as const, data: 'Удалённый GMIB не поддерживает это действие планировщика' },
});
const prepareJob = (job: PlayerSchedulerJobInput): PlayerSchedulerJobInput => {
  const { repeatCount, completionAction, expiresAt, stopOnExpiry, ...rest } = job;
  const base = supportsFeature('playerSchedulerExpiry', version, isRemoteSession)
    ? {
        ...rest,
        expiresAt: job.kind === 'cron' ? (expiresAt ?? '') : '',
        stopOnExpiry: job.kind === 'cron' && Boolean(expiresAt) && Boolean(stopOnExpiry),
      }
    : rest;
  return job.action === 'play-playlist-times' &&
    supportsFeature('playerPlaylistRepeat', version, isRemoteSession)
    ? { ...base, repeatCount, completionAction }
    : base;
};

const schedulerApi = createApi({
  baseQuery,
  reducerPath: 'schedulerApi',
  tagTypes: ['scheduler'],
  endpoints: build => ({
    getSchedulerJobs: build.query<PlayerSchedulerJob[], number | undefined>({
      query: playerId => ({
        url: 'scheduler',
        params: playerId == null ? undefined : { playerId },
      }),
      providesTags: result =>
        result
          ? [
              { type: 'scheduler' as const, id: 'LIST' },
              ...result.map(job => ({ type: 'scheduler' as const, id: job.id })),
            ]
          : [{ type: 'scheduler' as const, id: 'LIST' }],
    }),
    createSchedulerJob: build.mutation<PlayerSchedulerJob, PlayerSchedulerJobInput>({
      queryFn: async (job, _api, _options, query) => {
        if (!canUseAction(job.action)) return unsupported();
        const result = await query({ url: 'scheduler', method: 'POST', body: prepareJob(job) });
        return result.error ? { error: result.error } : { data: result.data as PlayerSchedulerJob };
      },
      invalidatesTags: [{ type: 'scheduler', id: 'LIST' }],
    }),
    updateSchedulerJob: build.mutation<
      PlayerSchedulerJob,
      { id: string; job: PlayerSchedulerJobInput }
    >({
      queryFn: async ({ id, job }, _api, _options, query) => {
        if (!canUseAction(job.action)) return unsupported();
        const result = await query({
          url: `scheduler/${id}`,
          method: 'PUT',
          body: prepareJob(job),
        });
        return result.error ? { error: result.error } : { data: result.data as PlayerSchedulerJob };
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'scheduler' as const, id },
        { type: 'scheduler' as const, id: 'LIST' },
      ],
    }),
    runSchedulerJob: build.mutation<PlayerSchedulerJob, Pick<PlayerSchedulerJob, 'id' | 'action'>>({
      queryFn: async ({ id, action }, _api, _options, query) => {
        if (!canUseAction(action)) return unsupported();
        const result = await query({ url: `scheduler/${id}/run`, method: 'POST' });
        return result.error ? { error: result.error } : { data: result.data as PlayerSchedulerJob };
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'scheduler' as const, id },
        { type: 'scheduler' as const, id: 'LIST' },
      ],
    }),
    deleteSchedulerJob: build.mutation<void, string>({
      query: id => ({
        url: `scheduler/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'scheduler', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetSchedulerJobsQuery,
  useCreateSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
  useRunSchedulerJobMutation,
  useDeleteSchedulerJobMutation,
} = schedulerApi;

export default schedulerApi;
