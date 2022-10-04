import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import type { DisplayType } from '/@common/video';
import baseQuery from '../../authBaseQuery';

const displayAdapter = createEntityAdapter<DisplayType>({
  sortComparer: (a, b) => {
    if (a.bounds.y < b.bounds.y) return -1;
    if (a.bounds.y > b.bounds.y) return 1;
    if (a.bounds.x < b.bounds.x) return -1;
    if (a.bounds.x > b.bounds.x) return 1;
    return 0;
  },
});

export const { selectAll: selectDisplays, selectById: selectDisplay } =
  displayAdapter.getSelectors();

const displayApi = createApi({
  baseQuery,
  reducerPath: 'displayApi',
  tagTypes: ['display'],
  endpoints: build => ({
    getDisplays: build.query<EntityState<DisplayType>, void>({
      query: () => 'display',
      transformResponse: (response: DisplayType[]) =>
        displayAdapter.addMany(displayAdapter.getInitialState(), response),
    }),
  }),
});

export const useDisplays = () =>
  displayApi.useGetDisplaysQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      displays: data && selectDisplays(data),
      ...other,
    }),
    // pollingInterval: 5000,
  });

export const useDisplay = (id?: number | null) =>
  displayApi.useGetDisplaysQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      display: data && id ? selectDisplay(data, id) : undefined,
      ...other,
    }),
    pollingInterval: 3000,
  });

export const { useGetDisplaysQuery } = displayApi;

export default displayApi;
