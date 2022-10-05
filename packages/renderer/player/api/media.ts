import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import type { MediaInfo } from '/@common/mediaInfo';

import baseQuery from '../../common/authBaseQuery';

const mediaAdapter = createEntityAdapter<MediaInfo>({
  selectId: ({ md5 }) => md5,
  sortComparer: (a, b) =>
    a.uploadTime && b.uploadTime
      ? new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
      : 0,
});

export const { selectAll: selectMediaAll, selectById: selectMediaById } =
  mediaAdapter.getSelectors();

const mediaApi = createApi({
  baseQuery,
  reducerPath: 'mediaApi',
  tagTypes: ['media'],
  endpoints: build => ({
    getMedia: build.query<EntityState<MediaInfo>, void>({
      query: () => 'media',
      transformResponse: (response: MediaInfo[]) =>
        mediaAdapter.addMany(mediaAdapter.getInitialState(), response),
    }),
    deleteMediaById: build.mutation<void, string>({
      query: id => ({
        url: `media/${id}`,
        method: 'DELETE',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          mediaApi.util.updateQueryData('getMedia', undefined, draft => {
            mediaAdapter.removeOne(draft, id);
          }),
        );
        queryFulfilled.catch(patchResult.undo);
      },
    }),
    uploadMedia: build.mutation<MediaInfo[], File[] | FileList>({
      query: files => {
        const formData = new FormData();
        [...files].forEach(file => {
          formData.append(file.name, file);
        });
        return {
          url: 'media',
          method: 'POST',
          body: formData,
        };
      },
      async onQueryStarted(files, { dispatch, queryFulfilled }) {
        const now = Date.now();
        [...files].forEach((file, index) => {
          const md5 = `temp-${now + index}`;
          const item = {
            md5,
            filename: file.name,
            original: {
              md5,
              filename: file.name,
            },
            duration: 0,
            size: file.size,
            streams: 0,
            width: 0,
            height: 0,
            uploadTime: new Date(now + index).toISOString(),
          };
          dispatch(
            mediaApi.util.updateQueryData('getMedia', undefined, draft => {
              mediaAdapter.addOne(draft, item);
            }),
          );
        });
        const { data: result } = await queryFulfilled;
        dispatch(
          mediaApi.util.updateQueryData('getMedia', undefined, draft => {
            mediaAdapter.setAll(draft, result);
          }),
        );
      },
    }),
  }),
});

export const { useGetMediaQuery, useUploadMediaMutation, useDeleteMediaByIdMutation } = mediaApi;

export const useGetMedia = () =>
  mediaApi.useGetMediaQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      data: data && selectMediaAll(data),
      ...other,
    }),
  });

export const useGetMediaById = (id?: string | null) =>
  mediaApi.useGetMediaQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      data: data && id && selectMediaById(data, id),
      ...other,
    }),
  });

export default mediaApi;
