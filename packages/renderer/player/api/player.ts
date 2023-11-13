import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import { sourceId } from '../utils';
import baseQuery from '../../common/authBaseQuery';

import type { Player } from '/@common/video';
import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import type { AppThunkConfig } from '../store';

export const playerAdapter = createEntityAdapter<Player>();

export const { selectAll: selectPlayers, selectById: selectPlayer } = playerAdapter.getSelectors();

const defaultPlayer: Omit<Player, 'id'> = {
  name: 'Новый плеер',
  width: 320,
  height: 240,
  // current: 0,
};

const playerApi = createApi({
  baseQuery,
  reducerPath: 'playerApi',
  tagTypes: ['player'],
  endpoints: build => ({
    getPlayers: build.query<EntityState<Player>, void>({
      query: () => 'player',
      transformResponse: (response: Player[]) =>
        playerAdapter.addMany(playerAdapter.getInitialState(), response),
    }),
    // getPlayer: build.query<Player, number>({
    //   query: id => `/player/${id}`,
    // }),
    updatePlayer: build.mutation<Player, Player>({
      query: player => ({
        url: '/player',
        method: 'PUT',
        body: player,
      }),
      async onQueryStarted(player, { dispatch, queryFulfilled }) {
        // const patchResult = dispatch(
        //   playerApi.util.updateQueryData('getPlayers', undefined, draft => {
        //     playerAdapter.setOne(draft, player);
        //   }),
        // );
        // queryFulfilled.catch(patchResult.undo);

        try {
          const { data } = await queryFulfilled;
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          if (!debouncedUpdatePlayer.pending) {
            dispatch(
              playerApi.util.updateQueryData('getPlayers', undefined, draft => {
                playerAdapter.setOne(draft, data);
              }),
            );
          }
        } catch (e) {
          // console.error('error while updatePlayer', e);
          dispatch(
            playerApi.endpoints.getPlayers.initiate(undefined, {
              subscribe: false,
              forceRefetch: true,
            }),
          );
        }
      },
    }),
    createPlayer: build.mutation<Player, Partial<Player>>({
      query: player => ({
        url: '/player',
        method: 'POST',
        body: { ...defaultPlayer, ...player },
      }),
      onQueryStarted(_, { dispatch, queryFulfilled }) {
        queryFulfilled.then(({ data: player }) => {
          dispatch(
            playerApi.util.updateQueryData('getPlayers', undefined, draft => {
              playerAdapter.setOne(draft, player);
            }),
          );
        });
      },
    }),
    deletePlayer: build.mutation<void, number>({
      query: id => ({
        url: `/player/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          playerApi.util.updateQueryData('getPlayers', undefined, draft => {
            playerAdapter.removeOne(draft, id);
          }),
        );
        queryFulfilled.catch(patchResult.undo);
      },
    }),
    stopPlayer: build.mutation<void, void>({
      query: () => ({
        url: `/player/${sourceId}/stop`,
        method: 'PUT',
      }),
    }),
  }),
});

export const usePlayers = () =>
  playerApi.useGetPlayersQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      players: data && selectPlayers(data),
      ...other,
    }),
    // pollingInterval: 5000,
  });

export const usePlayer = (id?: number | null) =>
  playerApi.useGetPlayersQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      player: data && id ? selectPlayer(data, id) : undefined,
      ...other,
    }),
  });

export const {
  useGetPlayersQuery,
  useUpdatePlayerMutation,
  useCreatePlayerMutation,
  useDeletePlayerMutation,
} = playerApi;

export const debouncedUpdatePlayer = createDebouncedAsyncThunk<void, Player, AppThunkConfig>(
  'playerApi/pendingUpdate',
  (player, { dispatch }) => {
    dispatch(playerApi.endpoints.updatePlayer.initiate(player));
  },
  200,
  { selectId: player => player.id, maxWait: 500 },
);

export default playerApi;
