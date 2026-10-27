import type { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import generateSignature from '/@common/generateSignature';

const fixtures = vi.hoisted(() => ({
  ipcMain: undefined as EventEmitter | undefined,
  outgoing: new Map<string, string>(),
  readGate: undefined as Promise<void> | undefined,
  readStarted: vi.fn(),
  writeGate: undefined as Promise<void> | undefined,
  writeGates: [] as Promise<void>[],
  writeFailure: undefined as Error | undefined,
  writeStarted: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  const ipcMain = new EventEmitter();
  fixtures.ipcMain = ipcMain;
  return {
    app: { whenReady: () => Promise.resolve() },
    ipcMain: Object.assign(ipcMain, { handle: vi.fn() }),
  };
});

vi.mock('../src/localConfig', () => ({
  default: { get: (key: string) => (key === 'identifier' ? 'local-client' : undefined) },
}));

vi.mock('../src/remoteAuthConfig', () => ({
  getRemoteAuthCredentials: vi.fn(async () => ({ revision: 0 })),
}));

vi.mock('../src/db', () => ({
  promisifyGet:
    (query: string, encode: (id: string) => string, decode: (row: unknown) => unknown) =>
    async (id: string) => {
      if (!query.includes('FROM osecret')) return undefined;
      const secret = fixtures.outgoing.get(encode(id));
      if (fixtures.readGate) {
        fixtures.readStarted(id);
        await fixtures.readGate;
      }
      return secret === undefined ? undefined : decode({ id, secret });
    },
  promisifyRun:
    (query: string, encode: (id: string, secret: bigint) => { $id: string; $secret: string }) =>
    async (id: string, secret: bigint) => {
      if (!query.includes('INTO osecret')) return undefined;
      fixtures.writeStarted(id);
      await (fixtures.writeGates.shift() ?? fixtures.writeGate);
      if (fixtures.writeFailure) throw fixtures.writeFailure;
      const values = encode(id, secret);
      fixtures.outgoing.set(values.$id, values.$secret);
      return { changes: 1 };
    },
  removeNull: (row: Record<string, unknown>) => row,
}));

const remote = 'http://remote-host:9002/api';
const identifierUrl = `${remote}/identifier`;
const announceUrl = `${remote}/announce`;
const remoteId = 'remote-device';
const testSecret = 0x123456789abcdef0n;

const signedFetches = () =>
  fixtures.fetch.mock.calls.filter(([url]) => url === announceUrl) as [string, RequestInit][];

const startRequest = async () => {
  const { default: authRequest } = await import('../src/authRequest');
  await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(1));
  const request = authRequest({ api: '/announce', host: 'remote-host', port: 9002 });
  await vi.waitFor(() => expect(fixtures.fetch).toHaveBeenCalledWith(identifierUrl));
  return { request };
};

beforeEach(() => {
  vi.resetModules();
  fixtures.ipcMain?.removeAllListeners();
  fixtures.outgoing.clear();
  fixtures.readGate = undefined;
  fixtures.readStarted.mockReset();
  fixtures.writeGate = undefined;
  fixtures.writeGates = [];
  fixtures.writeFailure = undefined;
  fixtures.writeStarted.mockReset();
  fixtures.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === identifierUrl) return new Response(remoteId);
    if (url === announceUrl) return new Response('remote license');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fixtures.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe('remote authenticated requests', () => {
  it('uses login that completed while the first missing-secret read was pending', async () => {
    let releaseRead: (() => void) | undefined;
    fixtures.readGate = new Promise<void>(resolve => {
      releaseRead = resolve;
    });

    const { request } = await startRequest();
    await vi.waitFor(() => expect(fixtures.readStarted).toHaveBeenCalledWith(remoteId));
    expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(2);

    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);
    await vi.waitFor(() => expect(fixtures.outgoing.has(remoteId)).toBe(true));
    releaseRead?.();

    await vi.waitFor(() => expect(signedFetches()).toHaveLength(1), { timeout: 2000 });
    const response = await request;
    expect(await response?.text()).toBe('remote license');
    expect(fixtures.fetch).toHaveBeenCalledTimes(2);
  });

  it('fetches announce on the first login after the outgoing secret write commits', async () => {
    let commitWrite: (() => void) | undefined;
    fixtures.writeGate = new Promise<void>(resolve => {
      commitWrite = resolve;
    });

    const { request } = await startRequest();
    await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(2));
    let settled = false;
    void request.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);
    await vi.waitFor(() => expect(fixtures.writeStarted).toHaveBeenCalledWith(remoteId));
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(signedFetches()).toHaveLength(0);

    commitWrite?.();
    const response = await request;
    expect(await response?.text()).toBe('remote license');
    expect(signedFetches()).toHaveLength(1);
    const headers = new Headers(signedFetches()[0][1].headers);
    expect(headers.get('x-ni-identifier')).toBe('local-client');
    expect(headers.get('x-ni-signature')).toBe(
      generateSignature(
        Buffer.from(testSecret.toString(16), 'hex'),
        'GET',
        announceUrl,
        Number(headers.get('x-ni-timestamp')),
      ),
    );
  });

  it.each([false, true])(
    'retries a rejected saved key after login, including login before the 401 response (%s)',
    async loginBeforeResponse => {
      fixtures.outgoing.set(remoteId, Buffer.from('deadbeef', 'hex').toString('base64'));
      let rejectSavedKey: (() => void) | undefined;
      const rejected = new Promise<void>(resolve => {
        rejectSavedKey = resolve;
      });
      let requests = 0;
      fixtures.fetch.mockImplementation(async (url: string) => {
        if (url === identifierUrl) return new Response(remoteId);
        if (url === announceUrl && requests++ === 0) {
          await rejected;
          return new Response('', { status: 401 });
        }
        if (url === announceUrl) return new Response('verified remote license');
        throw new Error(`Unexpected request: ${url}`);
      });
      const { request } = await startRequest();
      await vi.waitFor(() => expect(signedFetches()).toHaveLength(1));
      if (!loginBeforeResponse) {
        rejectSavedKey?.();
        await new Promise<void>(resolve => setImmediate(resolve));
      }
      fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);
      await vi.waitFor(() => expect(fixtures.writeStarted).toHaveBeenCalledWith(remoteId));
      rejectSavedKey?.();

      const response = await request;
      expect(await response?.text()).toBe('verified remote license');
      expect(signedFetches()).toHaveLength(2);
      const headers = new Headers(signedFetches()[1][1].headers);
      expect(headers.get('x-ni-signature')).toBe(
        generateSignature(
          Buffer.from(testSecret.toString(16), 'hex'),
          'GET',
          announceUrl,
          Number(headers.get('x-ni-timestamp')),
        ),
      );
      expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(1);
    },
  );

  it('returns a rejected mutation without waiting for login or retrying it', async () => {
    fixtures.outgoing.set(remoteId, Buffer.from('deadbeef', 'hex').toString('base64'));
    fixtures.fetch.mockImplementation(async (url: string) =>
      url === identifierUrl ? new Response(remoteId) : new Response('', { status: 401 }),
    );
    const { default: authRequest } = await import('../src/authRequest');
    const response = await authRequest({
      api: '/announce',
      method: 'POST',
      host: 'remote-host',
      port: 9002,
    });
    expect(response?.status).toBe(401);
    expect(signedFetches()).toHaveLength(1);
    expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(1);
  });

  it('stops waiting for a rejected saved key when login is cancelled', async () => {
    fixtures.outgoing.set(remoteId, Buffer.from('deadbeef', 'hex').toString('base64'));
    fixtures.fetch.mockImplementation(async (url: string) =>
      url === identifierUrl ? new Response(remoteId) : new Response('', { status: 401 }),
    );
    const { request } = await startRequest();
    await vi.waitFor(() => expect(signedFetches()).toHaveLength(1));
    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, null);
    await expect(request).resolves.toBeUndefined();
    expect(signedFetches()).toHaveLength(1);
    expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(1);
  });

  it('does not fetch announce when login is cancelled', async () => {
    const { request } = await startRequest();
    await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(2));
    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, null);

    await expect(request).resolves.toBeUndefined();
    expect(signedFetches()).toHaveLength(0);
    expect(fixtures.fetch).toHaveBeenCalledTimes(1);
    expect(fixtures.writeStarted).not.toHaveBeenCalled();
  });

  it('ignores a login for another remote host while waiting', async () => {
    const { request } = await startRequest();
    await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(2));
    let settled = false;
    void request.then(() => {
      settled = true;
    });

    fixtures.ipcMain?.emit('setRemoteSecret', null, 'other-device', testSecret);
    await vi.waitFor(() => expect(fixtures.writeStarted).toHaveBeenCalledWith('other-device'));
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(fixtures.fetch).toHaveBeenCalledTimes(1);

    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);
    const response = await request;
    expect(await response?.text()).toBe('remote license');
    expect(signedFetches()).toHaveLength(1);
  });

  it('serializes replacement keys so the latest secret remains stored', async () => {
    let commitFirstWrite: (() => void) | undefined;
    fixtures.writeGates = [
      new Promise<void>(resolve => {
        commitFirstWrite = resolve;
      }),
    ];
    const { getOutgoingSecret } = await import('../src/secret');
    await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(1));

    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);
    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, 0xfedcba9876543210n);
    await vi.waitFor(() => expect(fixtures.writeStarted).toHaveBeenCalledTimes(1));
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(fixtures.writeStarted).toHaveBeenCalledTimes(1);

    commitFirstWrite?.();
    await vi.waitFor(() => expect(fixtures.writeStarted).toHaveBeenCalledTimes(2));
    const latest = Buffer.from('fedcba9876543210', 'hex');
    await expect(getOutgoingSecret(remoteId)).resolves.toEqual(latest);
    expect(fixtures.outgoing.get(remoteId)).toBe(latest.toString('base64'));
  });

  it('does not fetch announce when saving the login secret fails', async () => {
    fixtures.writeFailure = new Error('database write failed');
    const { request } = await startRequest();
    await vi.waitFor(() => expect(fixtures.ipcMain?.listenerCount('setRemoteSecret')).toBe(2));

    fixtures.ipcMain?.emit('setRemoteSecret', null, remoteId, testSecret);

    await expect(request).resolves.toBeUndefined();
    expect(fixtures.writeStarted).toHaveBeenCalledWith(remoteId);
    expect(signedFetches()).toHaveLength(0);
  });

  it('uses an already stored outgoing secret without waiting for login', async () => {
    fixtures.outgoing.set(remoteId, Buffer.from(testSecret.toString(16), 'hex').toString('base64'));

    const { request } = await startRequest();
    const response = await request;

    expect(await response?.text()).toBe('remote license');
    expect(signedFetches()).toHaveLength(1);
    expect(fixtures.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not fetch announce when the remote identifier lookup fails', async () => {
    fixtures.fetch.mockImplementation(async (url: string) => {
      if (url === identifierUrl) return new Response('', { status: 503 });
      throw new Error(`Unexpected request: ${url}`);
    });

    const { request } = await startRequest();
    await expect(request).resolves.toBeUndefined();
    expect(signedFetches()).toHaveLength(0);
  });
});
