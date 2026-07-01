import { createApi } from '@reduxjs/toolkit/query/react';

import baseQuery from '../../common/authBaseQuery';

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
      query: job => ({
        url: 'gmib-scheduler',
        method: 'POST',
        body: job,
      }),
      invalidatesTags: [{ type: 'gmibScheduler', id: 'LIST' }],
    }),
    updateSchedulerJob: build.mutation<
      GmibSchedulerJob,
      { id: string; job: GmibSchedulerJobInput }
    >({
      query: ({ id, job }) => ({
        url: `gmib-scheduler/${id}`,
        method: 'PUT',
        body: job,
      }),
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
