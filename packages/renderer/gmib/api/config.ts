import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';
import debugFactory from 'debug';
import type { SetStateAction } from 'react';

import baseQuery from '../../common/authBaseQuery';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);

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
    }),
  }),
});

export const { useActivateMutation } = configApi;

export default configApi;
