/// <reference lib="dom" />
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

import { host, isRemoteSession, port } from '/@common/remote';

const baseUrl = host && port ? `http://${host}:${+port + 1}/api` : '/api';
const secret = window.identify.getSecret();
const identifier = window.identify.getIdentifier();

const defaultBaseQuery = fetchBaseQuery({
  baseUrl,
  ...(!isRemoteSession && {
    prepareHeaders: headers => {
      headers.set('authorization', `Bearer ${secret}`);
      return headers;
    },
  }),
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // signal: AbortSignal.timeout(3000),
});

const remoteBaseQuery: ReturnType<typeof fetchBaseQuery> = (arg, api, extra) => {
  const {
    url: originalUrl,
    method = 'GET' as const,
    headers: originalHeaders = {},
    body = undefined,
    ...rest
  } = typeof arg === 'string' ? { url: arg } : arg;
  const now = Date.now();
  const url = `${baseUrl}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
  const headers = new Headers(originalHeaders as Headers);
  const signature = window.identify.generateSignature(method, url, now, body);
  if (signature) {
    identifier && headers.set('x-ni-identifier', identifier);
    headers.set('x-ni-timestamp', now.toString());
    headers.set('x-ni-signature', signature);
  }
  return defaultBaseQuery({ url, method, headers, body, ...rest }, api, extra);
};

export default isRemoteSession ? remoteBaseQuery : defaultBaseQuery;
