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

// Credentials can wait for a database read or a login dialog. Race those waits
// as well as fetch, so closing a connection removes its authentication observer.
const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', aborted);
    const aborted = () => {
      cleanup();
      const reason: unknown = signal.reason;
      reject(reason instanceof Error ? reason : new Error('Запрос отменён', { cause: reason }));
    };
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(
      value => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error('Ошибка авторизации', { cause: error }));
      },
    );
  });
};

type Props = {
  api: string;
  host?: string;
  port?: number;
  method?: string;
  body?: unknown;
  binaryBody?: Uint8Array;
  headers?: HeadersInit;
  signal?: AbortSignal;
  redirect?: RequestRedirect;
};
const authRequest = async ({
  api,
  host = 'localhost',
  port = Number(process.env['NIBUS_PORT'] ?? 9001) + 1,
  body: originalBody,
  binaryBody,
  headers: originalHeaders,
  method = 'GET',
  signal,
  redirect,
}: Props): Promise<Response | undefined> => {
  signal?.throwIfAborted();
  const baseUrl = `http://${host}:${port}/api`;
  const url = `${baseUrl}${api.startsWith('/') ? '' : '/'}${api}`;
  const headers = new Headers(originalHeaders);
  if (binaryBody !== undefined && originalBody !== undefined)
    throw new Error('JSON и двоичное тело нельзя передавать одновременно');
  let body: string | Uint8Array<ArrayBuffer> | undefined;
  if (binaryBody !== undefined) {
    // Archive requests authenticate the expected SHA-256 in the URL; the server
    // streams bytes after auth and verifies that digest before inspect/install.
    body = new Uint8Array(binaryBody);
    headers.set('Content-Type', 'application/octet-stream');
  }
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
      let credentials: Credentials | undefined = await withAbort(
        getRemoteCredentials(`${baseUrl}/identifier`),
        signal,
      );
      if (credentials?.remoteIdentifier && !credentials.apiSecret) {
        if (!(await withAbort(auth.wait(credentials.remoteIdentifier, revision), signal)))
          return undefined;
        revision = auth.revision;
        credentials = await withAbort(getRemoteCredentials(`${baseUrl}/identifier`), signal);
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!credentials?.apiSecret || !credentials.identifier) return undefined;
        const now = Date.now();
        const signature = generateSignature(
          credentials.apiSecret,
          method,
          url,
          now,
          binaryBody === undefined ? body : undefined,
        );
        if (signature) {
          headers.set('x-ni-identifier', credentials.identifier);
          headers.set('x-ni-timestamp', now.toString());
          headers.set('x-ni-signature', signature);
        }
        const response = await fetch(url, { headers, body, method, signal, redirect });
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
        if (!(await withAbort(auth.wait(credentials.remoteIdentifier, revision), signal)))
          return undefined;
        credentials = await withAbort(getRemoteCredentials(`${baseUrl}/identifier`), signal);
      }
      return undefined;
    } finally {
      auth.dispose();
    }
  }
  headers.set('authorization', `Bearer ${secret.toString('base64')}`);
  return fetch(url, { headers, body, method, signal, redirect });
};

export default authRequest;
