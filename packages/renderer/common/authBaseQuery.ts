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

const appendParams = (url: string, params: unknown): string => {
  if (params == null) return url;
  const searchParams = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => searchParams.append(key, value));
  } else if (typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item != null) searchParams.append(key, String(item));
        });
      } else {
        searchParams.append(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  if (!query) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
};

const makeSignedQueryArg = async (
  arg: Parameters<ReturnType<typeof fetchBaseQuery>>[0],
): Promise<Parameters<ReturnType<typeof fetchBaseQuery>>[0]> => {
  const {
    url: originalUrl,
    method = 'GET' as const,
    headers: originalHeaders = {},
    body = undefined,
    params = undefined,
    ...rest
  } = typeof arg === 'string' ? { url: arg } : arg;
  const now = Date.now();
  const url = appendParams(
    `${baseUrl}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`,
    params,
  );
  const headers = new Headers(originalHeaders as Headers);
  const signatureBody = body instanceof FormData ? undefined : body;
  const signature = await window.identify.generateSignature(method, url, now, signatureBody);
  if (signature) {
    if (!identifier) identifier = window.identify.getIdentifier();
    identifier && headers.set('x-ni-identifier', identifier);
    headers.set('x-ni-timestamp', now.toString());
    headers.set('x-ni-signature', signature);
    headers.set('x-ni-source-id', `${sourceId}`);
  }
  return { url, method, headers, body, ...rest };
};

const remoteBaseQuery: ReturnType<typeof fetchBaseQuery> = async (arg, api, extra) => {
  const signedArg = await makeSignedQueryArg(arg);
  return defaultBaseQuery(signedArg, api, extra);
};

// console.log({ isRemoteSession });

export default isRemoteSession ? remoteBaseQuery : defaultBaseQuery;
