import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import baseQuery from '/@common/baseQuery';
import type { Screen } from '/@common/video';
import createDebouncedAsyncThunk from '/@common/createDebouncedAsyncThunk';

import type { SetStateAction } from 'react';

import type { AppThunk, AppThunkConfig, RootState } from '../store';
import { setCurrentScreen } from '../store/currentSlice';
import { selectCurrentScreenId } from '../store/selectors';

const adapter = createEntityAdapter<Screen>({
  selectId: ({ id }) => id,
});

export const {
  selectAll: selectScreens,
  selectById: selectScreen,
  selectTotal: selectTotalScreens,
} = adapter.getSelectors();

const screenApi = createApi({
  baseQuery,
  reducerPath: 'screenApi',
  tagTypes: ['screen'],
  endpoints: build => ({
    getScreens: build.query<EntityState<Screen>, void>({
      query: () => 'screen',
      transformResponse: (response: Screen[]) =>
        adapter.addMany(adapter.getInitialState(), response),
    }),
    createScreen: build.mutation<Screen, string | undefined | void>({
      query: name => ({
        url: 'screen',
        method: 'POST',
        body: { name: name ?? 'Новый экран' },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          screenApi.util.updateQueryData('getScreens', undefined, state => {
            adapter.addOne(state, data);
          }),
        );
        dispatch(setCurrentScreen(data.id));
      },
    }),
    deleteScreen: build.mutation<void, number>({
      query: id => ({
        url: `screen/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const patchResult = dispatch(
          screenApi.util.updateQueryData('getScreens', undefined, state => {
            adapter.removeOne(state, id);
          }),
        );
        const current = selectCurrentScreenId(getState() as RootState);
        if (current === id) {
          dispatch(setCurrentScreen(undefined));
        }
        queryFulfilled.catch(patchResult.undo);
      },
    }),
    updateScreen: build.mutation<Screen, Screen>({
      query: screen => ({
        url: 'screen',
        method: 'PUT',
        body: screen,
      }),
      async onQueryStarted(screen, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            screenApi.util.updateQueryData('getScreens', undefined, state => {
              adapter.setOne(state, data);
            }),
          );
        } catch {
          dispatch(screenApi.endpoints.getScreens.initiate());
        }
      },
    }),
    getAddresses: build.query<string[], void>({
      query: () => 'address',
      transformResponse: (response: { data: string[] | undefined }) =>
        response.data ? response.data.map(address => address.replace(/[+-].*$/, '')) : [],
    }),
  }),
});

export const {
  useGetScreensQuery,
  useCreateScreenMutation,
  useDeleteScreenMutation,
  useUpdateScreenMutation,
  useGetAddressesQuery,
} = screenApi;

const debouncedUpdateScreen = createDebouncedAsyncThunk<void, Screen, AppThunkConfig>(
  'screenApi/pendingUpdateScreen',
  (screen, { dispatch }) => {
    dispatch(screenApi.endpoints.updateScreen.initiate(screen));
  },
  100,
  { selectId: screen => screen.id, maxWait: 500 },
);

export const updateScreen =
  (id: number, update: SetStateAction<Omit<Screen, 'id'>>): AppThunk =>
  dispatch => {
    dispatch(
      screenApi.util.updateQueryData('getScreens', undefined, state => {
        const prev = selectScreen(state, id);
        if (!prev) throw new Error(`Unknown screen id: ${id}`);
        const screen = { id, ...(typeof update === 'function' ? update(prev) : update) };
        adapter.setOne(state, screen);
        dispatch(debouncedUpdateScreen(screen));
      }),
    );
  };

export default screenApi;
