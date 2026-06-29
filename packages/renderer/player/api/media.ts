import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import type { MediaInfo } from '/@common/mediaInfo';
import { host, isRemoteSession, port, sourceId } from '/@common/remote';

import baseQuery from '../../common/authBaseQuery';

export const mediaAdapter = createEntityAdapter<MediaInfo, string>({
  selectId: ({ md5 }) => md5,
  sortComparer: (a, b) =>
    a.uploadTime && b.uploadTime
      ? new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
      : 0,
});

export const { selectAll: selectMediaAll, selectById: selectMediaById } =
  mediaAdapter.getSelectors();

const baseUrl = host && port ? `http://${host}:${+port + 1}/api` : '/api';

export type MediaUploadProgress = {
  phase: 'queued' | 'uploading' | 'converting';
  progress?: number;
};

export type MediaTransferProgress =
  | MediaUploadProgress
  | { phase: 'failed'; error: unknown }
  | { phase: 'canceled' };

const getUploadHeaders = async (url: string, body: FormData): Promise<Headers> => {
  const headers = new Headers();
  if (isRemoteSession) {
    const now = Date.now();
    const signature = await window.identify.generateSignature('POST', url, now, body);
    const identifier = window.identify.getIdentifier();
    if (signature) {
      identifier && headers.set('x-ni-identifier', identifier);
      headers.set('x-ni-timestamp', now.toString());
      headers.set('x-ni-signature', signature);
      headers.set('x-ni-source-id', `${sourceId}`);
    }
  } else {
    headers.set('authorization', `Bearer ${window.identify.getSecret() ?? ''}`);
    headers.set('x-ni-source-id', `${sourceId}`);
  }
  return headers;
};

const xhrUpload = async (
  file: File,
  onProgress?: (progress: MediaUploadProgress) => void,
  signal?: AbortSignal,
): Promise<MediaInfo[]> => {
  const formData = new FormData();
  formData.append(file.name, file);

  const url = `${baseUrl}/media`;
  const headers = await getUploadHeaders(url, formData);

  return await new Promise<MediaInfo[]>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Загрузка отменена', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abortHandler = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener('abort', abortHandler);
    xhr.open('POST', url, true);
    signal?.addEventListener('abort', abortHandler, { once: true });
    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      onProgress?.({
        phase: 'uploading',
        progress: event.total > 0 ? Math.min(100, (event.loaded / event.total) * 100) : undefined,
      });
    };
    xhr.upload.onloadend = () => {
      if (!signal?.aborted) onProgress?.({ phase: 'converting', progress: 100 });
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Загрузка отменена', 'AbortError'));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Ошибка сети при загрузке'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('Таймаут при загрузке'));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const response = JSON.parse(xhr.responseText) as
            | { errors?: Array<{ filename?: string; message: string }> }
            | undefined;
          const message =
            response?.errors?.[0]?.message ?? (xhr.responseText || `HTTP ${xhr.status}`);
          reject(new Error(message));
        } catch {
          reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        }
        return;
      }
      try {
        const response = JSON.parse(xhr.responseText) as
          | MediaInfo[]
          | { media?: MediaInfo[]; errors?: Array<{ filename?: string; message: string }> };
        if (Array.isArray(response)) {
          resolve(response);
          return;
        }
        if (response.errors?.length) {
          reject(new Error(response.errors[0].message));
          return;
        }
        resolve(response.media ?? []);
      } catch {
        reject(new Error('Не удалось разобрать ответ сервера'));
      }
    };
    xhr.send(formData);
  });
};

const mediaApi = createApi({
  baseQuery,
  reducerPath: 'mediaApi',
  tagTypes: ['media'],
  endpoints: build => ({
    getMedia: build.query<EntityState<MediaInfo, string>, void>({
      query: () => 'media',
      transformResponse: (response: MediaInfo[]) =>
        mediaAdapter.addMany(mediaAdapter.getInitialState(), response),
    }),
    deleteMediaById: build.mutation<void, string>({
      query: id => ({
        url: `media/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled }) {
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
export const uploadMediaFile = xhrUpload;

export const useGetMedia = () =>
  mediaApi.useGetMediaQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      data: data && selectMediaAll(data),
      ...other,
    }),
    // pollingInterval: 5000,
  });

export const useGetMediaById = (id?: string | null) =>
  mediaApi.useGetMediaQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      data: data && id && selectMediaById(data, id),
      ...other,
    }),
  });

export default mediaApi;
