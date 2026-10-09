import { createApi } from '@reduxjs/toolkit/query/react';

import type { PlaybackSettings, PlaybackStatusSnapshot } from '/@common/playback';
import type {
  PlaybackHistory,
  PlaybackHistoryQuery,
  PlaybackStatistics,
  PlaybackStatisticsQuery,
} from '/@common/playbackStatistics';

import baseQuery from '../../common/authBaseQuery';
import { isPlaybackStatusSnapshot } from '../playback/playbackStore';

const playbackApi = createApi({
  reducerPath: 'playbackApi',
  baseQuery,
  tagTypes: ['PlaybackStatus', 'PlaybackSettings'],
  endpoints: build => ({
    getPlaybackStatus: build.query<PlaybackStatusSnapshot, void>({
      query: () => 'playback/status',
      transformResponse: (response: unknown) => {
        if (!isPlaybackStatusSnapshot(response)) throw new Error('Invalid playback status');
        return response;
      },
      providesTags: ['PlaybackStatus'],
    }),
    retryPlayback: build.mutation<void, string>({
      query: mediaId => ({ url: 'playback/retry', method: 'POST', body: { mediaId } }),
      invalidatesTags: ['PlaybackStatus'],
    }),
    getPlaybackSettings: build.query<PlaybackSettings, void>({
      query: () => 'playback/settings',
      providesTags: ['PlaybackSettings'],
    }),
    getPlaybackStatistics: build.query<PlaybackStatistics, PlaybackStatisticsQuery>({
      query: params => ({ url: 'playback/statistics', params }),
    }),
    getPlaybackHistory: build.query<PlaybackHistory, PlaybackHistoryQuery>({
      query: params => ({ url: 'playback/statistics/history', params }),
    }),
    updatePlaybackSettings: build.mutation<
      PlaybackSettings,
      Pick<PlaybackSettings, 'logRetentionDays'>
    >({
      query: body => ({ url: 'playback/settings', method: 'PUT', body }),
      invalidatesTags: ['PlaybackSettings'],
    }),
  }),
});

export const {
  useGetPlaybackSettingsQuery,
  useGetPlaybackStatusQuery,
  useGetPlaybackStatisticsQuery,
  useGetPlaybackHistoryQuery,
  useRetryPlaybackMutation,
  useUpdatePlaybackSettingsMutation,
} = playbackApi;
export default playbackApi;
