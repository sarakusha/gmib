import { fetchBaseQuery } from '@reduxjs/toolkit/query';

import { host, isRemoteSession, port } from '/@common/remote';

const baseUrl = host && port ? `http://${host}:${+port + 1}/api` : '/api';
const secret = window.identify.getSecret();
const identifier = window.identify.getIdentifier();

export default fetchBaseQuery({
  baseUrl,
  ...(!isRemoteSession && {
    prepareHeaders: headers => {
      headers.set('authorization', `Bearer ${secret}`);
      return headers;
    },
  }),
  ...(isRemoteSession && {
    fetchFn: (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      const headers = new Headers(init?.headers);
      const now = Date.now();
      const signature = window.identify.generateSignature(
        init?.method ?? 'GET',
        url,
        now,
        init?.body,
      );
      if (signature) {
        identifier && headers.set('X-NI-Identifier', identifier);
        headers.set('X-NI-Timestamp', now.toString());
        headers.set('X-NI-Signature', signature);
      }
      return fetch(input, { ...init, headers });
    },
  }),
});
