// import debugFactory from 'debug';

import { ipcMain } from 'electron';

import secret, { getRemoteCredentials } from './secret';

import generateSignature from '/@common/generateSignature';
import type { Credentials } from '/@common/Credentials';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:authRequest`);

// Subscribe before asynchronous credential reads/requests: login may complete while
// either is pending. Keep events scoped to their remote host and remove the listener
// when the request finishes, including failures and cancelled login.
const observeAuth = () => {
  const events: { identifier: string; authenticated: boolean }[] = [];
  let notify: (() => void) | undefined;
  const onSecret = (_e: Electron.IpcMainEvent, identifier: string, apiSecret: bigint | null) => {
    events.push({ identifier, authenticated: Boolean(apiSecret) });
    notify?.();
  };
  ipcMain.on('setRemoteSecret', onSecret);
  return {
    get revision() {
      return events.length;
    },
    async wait(identifier: string, since: number): Promise<boolean> {
      for (;;) {
        const event = events.slice(since).find(value => value.identifier === identifier);
        if (event) return event.authenticated;
        await new Promise<void>(resolve => {
          notify = resolve;
        });
      }
    },
    dispose() {
      ipcMain.off('setRemoteSecret', onSecret);
    },
  };
};

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
    const auth = observeAuth();
    try {
      let revision = auth.revision;
      let credentials: Credentials | undefined = await getRemoteCredentials(
        `${baseUrl}/identifier`,
      );
      if (credentials?.remoteIdentifier && !credentials.apiSecret) {
        if (!(await auth.wait(credentials.remoteIdentifier, revision))) return undefined;
        revision = auth.revision;
        credentials = await getRemoteCredentials(`${baseUrl}/identifier`);
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!credentials?.apiSecret || !credentials.identifier) return undefined;
        const now = Date.now();
        const signature = generateSignature(credentials.apiSecret, method, url, now, body);
        if (signature) {
          headers.set('x-ni-identifier', credentials.identifier);
          headers.set('x-ni-timestamp', now.toString());
          headers.set('x-ni-signature', signature);
        }
        const response = await fetch(url, { headers, body, method });
        if (
          response.status !== 401 ||
          attempt > 0 ||
          method !== 'GET' ||
          url !== `${baseUrl}/announce` ||
          !credentials.remoteIdentifier
        )
          return response;
        await response.body?.cancel().catch(() => undefined);
        // A saved key can become stale after host reinstallation or a password
        // change. Keep the initial announce pending until the login dialog supplies
        // a new key, rather than permanently registering the tab without a license.
        if (!(await auth.wait(credentials.remoteIdentifier, revision))) return undefined;
        credentials = await getRemoteCredentials(`${baseUrl}/identifier`);
      }
      return undefined;
    } finally {
      auth.dispose();
    }
  }
  headers.set('authorization', `Bearer ${secret.toString('base64')}`);
  return fetch(url, { headers, body, method });
};

export default authRequest;
