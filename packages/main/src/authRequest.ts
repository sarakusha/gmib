// import debugFactory from 'debug';

import { ipcMain } from 'electron';
import secret, { getRemoteCredentials } from './secret';

import generateSignature from '/@common/generateSignature';
import type { Credentials } from '/@common/Credentials';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:authRequest`);

const waitAuth = () =>
  new Promise<boolean>(resolve => {
    ipcMain.once('setRemoteSecret', (_e, remoteSecret) => {
      console.log({ resolve: !!remoteSecret });
      resolve(!!remoteSecret);
    });
  });

type Props = {
  api: string;
  host?: string;
  port?: number;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};
const authRequest = async ({
  api,
  host = 'localhost',
  port = Number(process.env['NIBUS_PORT'] ?? 9001) + 1,
  body: originalBody,
  headers: originalHeaders,
  method = 'GET',
}: Props): Promise<Response | undefined> => {
  const baseUrl = `http://${host}:${port}/api`;
  const url = `${baseUrl}${api.startsWith('/') ? '' : '/'}${api}`;
  const headers = new Headers(originalHeaders);
  let body: string | undefined;
  if (originalBody !== undefined) {
    if (typeof originalBody !== 'string') {
      body = JSON.stringify(originalBody);
      headers.set('Content-Type', 'application/json');
    } else body = originalBody;
  }
  if (host && host !== 'localhost') {
    let credentials: Credentials | undefined;
    credentials = await getRemoteCredentials(`${baseUrl}/identifier`);
    if (credentials && !credentials.apiSecret) {
      if (!(await waitAuth())) return undefined;
      credentials = await getRemoteCredentials(`${baseUrl}/identifier`);
      console.log({ credentials });
    }
    if (!credentials?.apiSecret || !credentials?.identifier) return undefined;
    const now = Date.now();
    const signature = generateSignature(credentials.apiSecret, method, url, now, body);
    if (signature) {
      headers.set('x-ni-identifier', credentials.identifier);
      headers.set('x-ni-timestamp', now.toString());
      headers.set('x-ni-signature', signature);
    }
  } else {
    headers.set('authorization', `Bearer ${secret.toString('base64')}`);
  }

  // debug(`${url} ${JSON.stringify([...headers])}`);

  return fetch(url, { headers, body, method });
};

export default authRequest;
