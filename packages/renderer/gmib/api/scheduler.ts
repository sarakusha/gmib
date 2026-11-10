import { createApi } from '@reduxjs/toolkit/query/react';

import baseQuery from '../../common/authBaseQuery';
import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';
import type { RootState } from '../store';

const prepareJob = (job: GmibSchedulerJobInput, state: unknown): GmibSchedulerJobInput => {
  const hostVersion = (state as RootState).config?.version ?? version;
  const { expiresAt, ...base } = job;
  return supportsFeature('gmibSchedulerExpiry', hostVersion, isRemoteSession)
    ? { ...base, expiresAt: job.kind === 'cron' ? (expiresAt ?? '') : '' }
    : base;
};

import type { GmibSchedulerJob, GmibSchedulerJobInput } from '/@common/scheduler';

const schedulerApi = createApi({
  baseQuery,
  reducerPath: 'gmibSchedulerApi',
  tagTypes: ['gmibScheduler'],
  endpoints: build => ({
    getSchedulerJobs: build.query<GmibSchedulerJob[], void>({
      query: () => 'gmib-scheduler',
      providesTags: result =>
        result
          ? [
              { type: 'gmibScheduler' as const, id: 'LIST' },
              ...result.map(job => ({ type: 'gmibScheduler' as const, id: job.id })),
            ]
          : [{ type: 'gmibScheduler' as const, id: 'LIST' }],
    }),
    createSchedulerJob: build.mutation<GmibSchedulerJob, GmibSchedulerJobInput>({
      queryFn: async (job, api, _options, query) => {
        const result = await query({
          url: 'gmib-scheduler',
          method: 'POST',
          body: prepareJob(job, api.getState()),
        });
        return result.error ? { error: result.error } : { data: result.data as GmibSchedulerJob };
      },
      invalidatesTags: [{ type: 'gmibScheduler', id: 'LIST' }],
    }),
    updateSchedulerJob: build.mutation<
      GmibSchedulerJob,
      { id: string; job: GmibSchedulerJobInput }
    >({
      queryFn: async ({ id, job }, api, _options, query) => {
        const result = await query({
          url: `gmib-scheduler/${id}`,
          method: 'PUT',
          body: prepareJob(job, api.getState()),
        });
        return result.error ? { error: result.error } : { data: result.data as GmibSchedulerJob };
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'gmibScheduler' as const, id },
        { type: 'gmibScheduler' as const, id: 'LIST' },
      ],
    }),
    runSchedulerJob: build.mutation<GmibSchedulerJob, string>({
      query: id => ({
        url: `gmib-scheduler/${id}/run`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'gmibScheduler' as const, id },
        { type: 'gmibScheduler' as const, id: 'LIST' },
      ],
    }),
    deleteSchedulerJob: build.mutation<void, string>({
      query: id => ({
        url: `gmib-scheduler/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'gmibScheduler', id: 'LIST' }],
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
