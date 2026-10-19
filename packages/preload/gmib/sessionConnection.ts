import type { INibusSession } from '@nibus/core';

export const SESSION_START_TIMEOUT_MS = 12_000;

type SessionConnection = Pick<INibusSession, 'start' | 'close' | 'on' | 'off'>;

/** Resolves only after the ports snapshot and a successful heartbeat have arrived. */
export function waitForSessionReady(
  session: SessionConnection,
  signal: AbortSignal,
  timeoutMs = SESSION_START_TIMEOUT_MS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let ports: number | undefined;
    let online = false;
    let hasConfig = false;
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      session.off('online', onOnline);
      session.off('config', onConfig);
      session.off('close', onClose);
      signal.removeEventListener('abort', onAbort);
    };
    const fail = (error: Error, closeSession = false): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (closeSession) session.close();
      reject(error);
    };
    const finishIfReady = (): void => {
      if (settled || !online || ports === undefined || !hasConfig) return;
      settled = true;
      cleanup();
      resolve(ports);
    };
    const onOnline = (value: boolean): void => {
      online = value;
      finishIfReady();
    };
    const onConfig = (): void => {
      hasConfig = true;
      finishIfReady();
    };
    const onClose = (): void => {
      queueMicrotask(() =>
        fail(new Error('NIBUS service connection closed before becoming ready')),
      );
    };
    const onAbort = (): void => {
      fail(new Error('NIBUS session startup was cancelled'), true);
    };
    const timer = setTimeout(() => {
      fail(new Error(`Timed out waiting for NIBUS service after ${timeoutMs} ms`), true);
    }, timeoutMs);

    session.on('online', onOnline);
    session.on('config', onConfig);
    session.on('close', onClose);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    try {
      void session.start().then(
        count => {
          ports = count;
          finishIfReady();
        },
        error => {
          fail(error instanceof Error ? error : new Error(String(error)));
        },
      );
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
