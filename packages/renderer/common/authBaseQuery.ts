/// <reference lib="dom" />
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

import { host, isRemoteSession, port, sourceId } from '/@common/remote';

const baseUrl = host && port ? `http://${host}:${+port + 1}/api` : '/api';
const secret = window.identify.getSecret();
let identifier: string | undefined;

const defaultBaseQuery = fetchBaseQuery({
  baseUrl,
  ...(!isRemoteSession && {
    prepareHeaders: headers => {
      headers.set('authorization', `Bearer ${secret}`);
      headers.set('x-ni-source-id', `${sourceId}`);
      return headers;
    },
  }),
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // signal: AbortSignal.timeout(3000),
});

const remoteBaseQuery: ReturnType<typeof fetchBaseQuery> = async (arg, api, extra) => {
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
  const signature = await window.identify.generateSignature(method, url, now, body);
  console.log({ signature });
  if (signature) {
    if (!identifier) identifier = window.identify.getIdentifier();
    identifier && headers.set('x-ni-identifier', identifier);
    headers.set('x-ni-timestamp', now.toString());
    headers.set('x-ni-signature', signature);
    headers.set('x-ni-source-id', `${sourceId}`);
  }
  return defaultBaseQuery({ url, method, headers, body, ...rest }, api, extra);
};

console.log({ isRemoteSession });

export default isRemoteSession ? remoteBaseQuery : defaultBaseQuery;
