// import type { SetStateAction } from 'react';
import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

// import type { AppThunk, AppThunkConfig } from '../store';
import baseQuery from '../../common/authBaseQuery';

import type { PlayerMapping } from '/@common/video';
// import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';

export const mappingAdapter = createEntityAdapter<PlayerMapping>();

export const { selectAll: selectMappings, selectById: selectMappingById } =
  mappingAdapter.getSelectors();

const mappingApi = createApi({
  baseQuery,
  reducerPath: 'mappingApi',
  endpoints: build => ({
    getMappings: build.query<EntityState<PlayerMapping>, void>({
      query: () => '/mapping',
      transformResponse: (response: PlayerMapping[]) =>
        mappingAdapter.addMany(mappingAdapter.getInitialState(), response),
    }),
    createMapping: build.mutation<PlayerMapping, Partial<PlayerMapping>>({
      query: mapping => ({
        url: '/mapping',
        method: 'POST',
        body: mapping,
      }),
      onQueryStarted(_, { dispatch, queryFulfilled }) {
        queryFulfilled.then(({ data: mapping }) => {
          dispatch(
            mappingApi.util.updateQueryData('getMappings', undefined, draft => {
              mappingAdapter.setOne(draft, mapping);
            }),
          );
        });
      },
    }),
    deleteMapping: build.mutation<void, number>({
      query: id => ({
        url: `/mapping/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          mappingApi.util.updateQueryData('getMappings', undefined, draft => {
            mappingAdapter.removeOne(draft, id);
          }),
        );
        queryFulfilled.catch(patchResult.undo);
      },
    }),
    updateMapping: build.mutation<PlayerMapping, PlayerMapping>({
      query: mapping => ({
        url: '/mapping',
        method: 'PUT',
        body: mapping,
      }),
      onQueryStarted(player, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          mappingApi.util.updateQueryData('getMappings', undefined, draft => {
            mappingAdapter.setOne(draft, player);
          }),
        );
        queryFulfilled.catch(patchResult.undo);
      },
    }),
  }),
});

export const usePlayerMappings = () =>
  mappingApi.useGetMappingsQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      ...other,
      mappings: data && selectMappings(data),
    }),
    pollingInterval: 5000,
  });

export const usePlayerMapping = (id: number | undefined | null) =>
  mappingApi.useGetMappingsQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      ...other,
      mapping: data && id ? selectMappingById(data, id) : undefined,
    }),
  });

export const {
  useGetMappingsQuery,
  useCreateMappingMutation,
  useDeleteMappingMutation,
  useUpdateMappingMutation,
} = mappingApi;

/* const debouncedUpdateMapping = createDebouncedAsyncThunk<void, PlayerMapping, AppThunkConfig>(
  'mappingApi/pendingUpdate',
  (mapping, { dispatch }) => {
    dispatch(mappingApi.endpoints.updateMapping.initiate(mapping));
  },
  200,
  { selectId: mapping => mapping.id, maxWait: 500 },
);

export const updateMapping =
  (id: number, update: SetStateAction<PlayerMapping>): AppThunk =>
  dispatch => {
    dispatch(
      mappingApi.util.updateQueryData('getMappings', undefined, draft => {
        const prev = selectMappingById(draft, id);
        if (!prev) throw new Error(`Unknown player mapping: ${id}`);
        const mapping = typeof update === 'function' ? update(prev) : prev;
        mappingAdapter.setOne(draft, { ...mapping, id });
        dispatch(debouncedUpdateMapping(mapping));
      }),
    );
  }; */

export default mappingApi;
