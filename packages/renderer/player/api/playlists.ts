import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';
import type { SetStateAction } from 'react';

import type { CreatePlaylist, InsertMedia, Playlist, RemoveMedia } from '/@common/playlist';

import baseQuery from '../../common/authBaseQuery';
import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import type { AppThunk, AppThunkConfig, RootState } from '../store';
import { setCurrentPlaylist } from '../store/currentSlice';
import { selectCurrentPlaylist } from '../store/selectors';

import playerApi, { selectPlayers } from './player';

const adapter = createEntityAdapter<Playlist>({
  selectId: ({ id }) => id,
  sortComparer: (a, b) =>
    a.creationTime && b.creationTime
      ? new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
      : 0,
});

export const { selectAll: selectPlaylists, selectById: selectPlaylistById } =
  adapter.getSelectors();

const playlistApi = createApi({
  baseQuery,
  reducerPath: 'playlistApi',
  tagTypes: ['playlist'],
  endpoints: build => ({
    getPlaylists: build.query<EntityState<Playlist>, void>({
      query: () => 'playlist',
      transformResponse: (response: Playlist[]) =>
        adapter.addMany(adapter.getInitialState(), response),
      async onQueryStarted(_, { queryFulfilled, getState, dispatch }) {
        const { data: playlistData } = await queryFulfilled;
        if (playlistData.ids.length > 0) {
          const currentPlaylist = selectCurrentPlaylist(getState() as RootState);
          if (currentPlaylist == null) {
            const [first] = playlistData.ids as number[];
            dispatch(setCurrentPlaylist(first));
          }
        }
      },
    }),
    createPlaylist: build.mutation<Playlist, CreatePlaylist>({
      query: create => ({
        url: 'playlist',
        method: 'POST',
        body: create,
      }),
      async onQueryStarted(create, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
            adapter.addOne(draft, data);
          }),
        );
      },
    }),
    updatePlaylist: build.mutation<Playlist, Playlist>({
      query: playlist => ({
        url: 'playlist',
        method: 'PUT',
        body: playlist,
      }),
      async onQueryStarted(playlist, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          if (!debouncedUpdatePlaylist.pending) {
            dispatch(
              playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
                adapter.setOne(draft, data);
              }),
            );
          }
        } catch {
          dispatch(playlistApi.endpoints.getPlaylists.initiate());
        }
      },
    }),
    insertMedia: build.mutation<Playlist, InsertMedia>({
      query: ({ id, insert }) => ({
        url: `playlist/${id}`,
        method: 'PATCH',
        body: { insert },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
            adapter.setOne(draft, data);
          }),
        );
      },
    }),
    removeMedia: build.mutation<Playlist, RemoveMedia>({
      query: ({ id, itemId }) => ({
        url: `playlist/${id}`,
        method: 'PATCH',
        body: { remove: itemId },
      }),
      onQueryStarted({ id, itemId }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
            const playlist = selectPlaylistById(draft, id);
            if (playlist) {
              const items = playlist.items.filter(item => item.id !== itemId);
              adapter.updateOne(draft, { id, changes: { items } });
            }
          }),
        );
        queryFulfilled
          .then(({ data }) => {
            dispatch(
              playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
                adapter.setOne(draft, data);
              }),
            );
          })
          .catch(patchResult.undo);
      },
    }),
    deletePlaylist: build.mutation<void, number>({
      query: id => ({
        url: `playlist/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled }) {
        const playerResult = dispatch(
          playerApi.util.updateQueryData('getPlayers', undefined, draft => {
            selectPlayers(draft).forEach(player => {
              // eslint-disable-next-line no-param-reassign
              if (player.playlistId === id) player.playlistId = null;
            });
          }),
        );
        const patchResult = dispatch(
          playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
            adapter.removeOne(draft, id);
          }),
        );
        queryFulfilled.catch(() => {
          patchResult.undo();
          playerResult.undo();
        });
      },
    }),
  }),
});

export const {
  useGetPlaylistsQuery,
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  // useUpdatePlaylistMutation,
  useInsertMediaMutation,
  useRemoveMediaMutation,
} = playlistApi;

export const useGetPlaylists = () =>
  playlistApi.useGetPlaylistsQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      data: data && selectPlaylists(data),
      ...other,
    }),
    pollingInterval: 5000,
  });

export const useGetPlaylistById = (id?: number | null) =>
  playlistApi.useGetPlaylistsQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      data: id && data ? selectPlaylistById(data, id) : undefined,
      ...other,
    }),
  });

const debouncedUpdatePlaylist = createDebouncedAsyncThunk<void, Playlist, AppThunkConfig>(
  'playlistApi/pendingUpdate',
  (playlist, { dispatch }) => {
    dispatch(playlistApi.endpoints.updatePlaylist.initiate(playlist));
  },
  200,
  { maxWait: 1000, selectId: ({ id }) => id },
);

export const updatePlaylist =
  (id: number | null, update: SetStateAction<Playlist>): AppThunk =>
  dispatch => {
    if (id == null) return;
    dispatch(
      playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
        const prev = selectPlaylistById(draft, id);
        if (!prev) throw new Error(`Unknown playlist: ${id}`);
        const playlist = typeof update === 'function' ? update(prev) : update;
        adapter.setOne(draft, playlist);
        dispatch(debouncedUpdatePlaylist(playlist));
      }),
    );
  };

export const moveItem =
  (id: number, from: number, to: number): AppThunk =>
  dispatch => {
    if (id == null) return;
    dispatch(
      playlistApi.util.updateQueryData('getPlaylists', undefined, draft => {
        const prev = selectPlaylistById(draft, id);
        if (!prev) throw new Error(`Unknown playlist: ${id}`);
        const { items, ...other } = prev;
        const newItems = [...items];
        const [item] = newItems.splice(from, 1);
        if (!item) return;
        newItems.splice(to, 0, item);
        adapter.setOne(draft, { items: newItems, ...other });
      }),
    );
  };

export default playlistApi;
