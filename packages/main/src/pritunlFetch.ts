import crypto from 'node:crypto';

import debugFactory from 'debug';
import { nanoid } from 'nanoid';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:pritunl`);

type PritunlQuery = {
  path: string;
  method?: string;
  query?: string[][] | Record<string, string> | string | URLSearchParams;
  data?: object;
};

const pritunlFetch = async ({ path, method = 'GET', query, data }: PritunlQuery) => {
  const apiToken = process.env.PRI_API_TOKEN;
  const apiSecret = process.env.PRI_API_SECRET;
  const baseUrl = process.env.PRITUNL_URL;

  if (!apiToken || !apiSecret || !baseUrl) return undefined;
  const authNonce = nanoid(32);
  const authTimeStamp = Math.floor(Date.now() / 1000);
  const authString = [apiToken, authTimeStamp, authNonce, method.toUpperCase(), path].join('&');
  const search = query ? `?${new URLSearchParams(query)}` : '';
  const url = new URL(`${path}${search}`, baseUrl);

  const res = await fetch(url, {
    method,
    headers: {
      'Auth-Token': apiToken,
      'Auth-Timestamp': authTimeStamp.toString(),
      'Auth-Nonce': authNonce,
      'Auth-Signature': crypto.createHmac('sha256', apiSecret).update(authString).digest('base64'),
      ...(data && { 'Content-Type': 'application/json' }),
    },
    body: data && JSON.stringify(data),
  });
  if (!res.ok) debug(`error while pritunl request: ${await res.text()}`);
  return res.ok ? res.json() : undefined;
};

export default pritunlFetch;
