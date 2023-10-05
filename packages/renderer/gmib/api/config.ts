import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';
// import debugFactory from 'debug';
import type { SetStateAction } from 'react';

import baseQuery from '../../common/authBaseQuery';

import type { Page } from '/@common/config';

import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';
import type { AppThunk, AppThunkConfig } from '../store';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);

const pageAdapter = createEntityAdapter<Page>({
  selectId: ({ id }) => id,
});

export const { selectAll: selectPages, selectById: selectPage } = pageAdapter.getSelectors();

const configApi = createApi({
  baseQuery,
  reducerPath: 'configApi',
  endpoints: build => ({
    activate: build.mutation<
      { plan?: string; key?: string; renew?: string },
      { key: string; name?: string }
    >({
      query: ({ key, name }) => ({
        url: 'activate',
        method: 'POST',
        body: { key, name },
      }),
      transformErrorResponse: (response) => response.data,
    }),
    getPages: build.query<EntityState<Page>, void>({
      query: () => 'pages',
      transformResponse: (response: Page[]) =>
        pageAdapter.addMany(pageAdapter.getInitialState(), response),
    }),
    createPage: build.mutation<Page, string | undefined>({
      query: title => ({
        url: 'pages',
        method: 'POST',
        body: { title },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            configApi.util.updateQueryData('getPages', undefined, draft => {
              pageAdapter.setOne(draft, data);
            }),
          );
        } catch (err) {
          console.error(`error while create page: ${err}`);
        }
      },
    }),
    updatePage: build.mutation<Page, Page>({
      query: page => ({
        url: `pages/${page.id}`,
        method: 'PUT',
        body: page,
      }),
      async onQueryStarted(page, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          if (!debouncedUpdatePage.pending(page.id)) {
            dispatch(
              configApi.util.updateQueryData('getPages', undefined, draft => {
                pageAdapter.setOne(draft, data);
              }),
            );
          }
        } catch {
          dispatch(configApi.endpoints.getPages.initiate());
        }
      },
    }),
    deletePage: build.mutation<void, string>({
      query: id => ({
        url: `pages/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          configApi.util.updateQueryData('getPages', undefined, draft => {
            pageAdapter.removeOne(draft, id);
          }),
        );
        queryFulfilled.catch(patchResult.undo);
      },
    }),
  }),
});

export const { useActivateMutation, useCreatePageMutation, useDeletePageMutation } = configApi;

export const usePages = () =>
  configApi.useGetPagesQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      pages: data ? selectPages(data) : [],
      ...other,
    }),
  });

export const usePage = (id?: string) =>
  configApi.useGetPagesQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      page: data && id ? selectPage(data, id) : undefined,
      ...other,
    }),
  });

const debouncedUpdatePage = createDebouncedAsyncThunk<void, Page, AppThunkConfig>(
  'screenApi/pendingUpdateScreen',
  (page, { dispatch }) => {
    dispatch(configApi.endpoints.updatePage.initiate(page));
  },
  200,
  { selectId: page => page.id, maxWait: 500 },
);

export const updatePage =
  (id: string, update: SetStateAction<Omit<Page, 'id'>>): AppThunk =>
    dispatch =>
      dispatch(
        configApi.util.updateQueryData('getPages', undefined, draft => {
          const prev = selectPage(draft, id);
          if (!prev) throw new Error(`Unknown page id: ${id}`);
          const page = { id, ...(typeof update === 'function' ? update(prev) : prev) };
          pageAdapter.setOne(draft, page);
          dispatch(debouncedUpdatePage(page));
        }),
      );

export default configApi;
