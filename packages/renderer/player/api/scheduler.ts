import { createApi } from '@reduxjs/toolkit/query/react';

import type { PlayerSchedulerJob, PlayerSchedulerJobInput } from '/@common/scheduler';

import baseQuery from '../../common/authBaseQuery';

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
      query: job => ({
        url: 'scheduler',
        method: 'POST',
        body: job,
      }),
      invalidatesTags: [{ type: 'scheduler', id: 'LIST' }],
    }),
    updateSchedulerJob: build.mutation<
      PlayerSchedulerJob,
      { id: string; job: PlayerSchedulerJobInput }
    >({
      query: ({ id, job }) => ({
        url: `scheduler/${id}`,
        method: 'PUT',
        body: job,
      }),
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
  useDeleteSchedulerJobMutation,
} = schedulerApi;

export default schedulerApi;
