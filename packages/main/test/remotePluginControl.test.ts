import { EventEmitter } from 'node:events';
import { request as httpRequest } from 'node:http';

import type { WebContents } from 'electron';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ request: vi.fn(), open: vi.fn(), support: vi.fn() }));
vi.mock('electron', () => ({ shell: { openExternal: mock.open } }));
vi.mock('../src/authRequest', () => ({ default: mock.request }));
vi.mock('../src/remotePluginLifecycle', () => ({ requireRemotePluginSupport: mock.support }));

import type { GmibWindowParams } from '/@common/WindowParams';
import { openRemotePluginControl, remoteControlPath } from '../src/remotePluginControl';

const params = {
  host: 'selected-host',
  nibusPort: 9001,
  info: { version: '5.7.1' },
} as GmibWindowParams;
const owners: EventEmitter[] = [];
const listing = { plugins: [{ manifest: { id: 'sample', control: { path: 'control.html' } } }] };
const owner = () => {
  const value = Object.assign(new EventEmitter(), {
    id: owners.length + 1,
    isDestroyed: () => false,
  });
  owners.push(value);
  return value as unknown as WebContents;
};
const setup = async () => {
  const currentOwner = owner();
  await openRemotePluginControl(params, 'sample', currentOwner);
  const launchUrl = mock.open.mock.calls.at(-1)![0] as string;
  const origin = new URL(launchUrl).origin;
  const bootstrap = await fetch(launchUrl, { redirect: 'manual' });
  const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
  return {
    currentOwner,
    origin,
    launchUrl,
    bootstrap,
    cookie,
    api: `${origin}/plugins/sample/api/state`,
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  mock.open.mockResolvedValue(undefined);
  mock.request.mockImplementation(async ({ api }: { api: string }) => {
    if (api === '/manage/v1/plugins') return Response.json(listing);
    return new Response('content', { headers: { 'Content-Type': 'text/plain' } });
  });
});
afterEach(() => {
  for (const value of owners.splice(0)) value.emit('destroyed');
});

describe('remote control proxy path mapping', () => {
  it('maps only one plugin and rejects ambiguous traversal paths', () => {
    expect(remoteControlPath('/plugins/sample/control.html?mode=wide', 'sample')).toBe(
      'static/control.html?mode=wide',
    );
    expect(remoteControlPath('/plugins/sample/api/output?x=1', 'sample')).toBe('api/output?x=1');
    for (const value of [
      '/plugins/other/api/state',
      '/plugins/sample/../other/control.html',
      '/plugins/sample/%2e%2e/secret',
      '/plugins/sample/%252e%252e/secret',
      '/plugins/sample/api%2fstate',
      '/plugins/sample/api%5cstate',
      '/plugins/sample/\\state',
      '/plugins/sample/%ZZ',
    ])
      expect(remoteControlPath(value, 'sample')).toBeUndefined();
  });
});

describe('remote plugin control proxy', () => {
  it('bootstraps an HttpOnly session and signs API requests for the registered host', async () => {
    const state = await setup();
    expect(state.bootstrap.status).toBe(302);
    expect(state.bootstrap.headers.get('location')).toBe('/plugins/sample/control.html');
    expect(state.bootstrap.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    const response = await fetch(state.api, {
      method: 'PUT',
      headers: { Cookie: state.cookie, Origin: state.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 4 }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('content');
    expect(mock.request.mock.calls.at(-1)?.[0]).toMatchObject({
      host: 'selected-host',
      port: 9002,
      api: '/manage/v1/plugins/sample/control/api/state',
      method: 'PUT',
      body: { value: 4 },
      redirect: 'error',
    });
  });

  it('rejects absent cookies, foreign Origin, foreign Host and another plugin', async () => {
    const state = await setup();
    expect((await fetch(state.api)).status).toBe(403);
    expect(
      (await fetch(state.api, { headers: { Cookie: state.cookie, Origin: 'http://evil.invalid' } }))
        .status,
    ).toBe(403);
    const foreignHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        state.api,
        { headers: { Cookie: state.cookie, Host: 'evil.invalid' } },
        response => {
          response.resume();
          response.once('end', () => resolve(response.statusCode));
        },
      );
      request.once('error', reject);
      request.end();
    });
    expect(foreignHostStatus).toBe(403);
    expect(
      (
        await fetch(state.api, {
          headers: { Cookie: state.cookie, 'Sec-Fetch-Site': 'cross-site' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${state.origin}/plugins/other/api/state`, {
          headers: { Cookie: state.cookie },
        })
      ).status,
    ).toBe(404);
    expect(mock.request).toHaveBeenCalledTimes(1);
  });

  it('rejects non-JSON mutations and never forwards remote secrets, cookies or redirects', async () => {
    const state = await setup();
    expect(
      (
        await fetch(state.api, {
          method: 'PUT',
          headers: { Cookie: state.cookie, 'Content-Type': 'text/plain' },
          body: 'value',
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await fetch(`${state.origin}/plugins/sample/control.html`, {
          method: 'POST',
          headers: { Cookie: state.cookie },
        })
      ).status,
    ).toBe(405);
    mock.request.mockResolvedValueOnce(
      new Response('safe body', {
        headers: {
          'Content-Type': 'text/html',
          'Set-Cookie': 'remote_secret=secret',
          Authorization: 'Bearer hidden-secret',
          Location: 'http://remote-private.invalid',
        },
      }),
    );
    const response = await fetch(`${state.origin}/plugins/sample/control.html`, {
      headers: { Cookie: state.cookie },
    });
    expect(await response.text()).toBe('safe body');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('authorization')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('returns a complete response larger than the socket high water mark', async () => {
    const state = await setup();
    const payload = 'x'.repeat(256 * 1024);
    mock.request.mockResolvedValueOnce(new Response(payload));
    const response = await fetch(state.api, { headers: { Cookie: state.cookie } });
    expect(await response.text()).toBe(payload);
  });

  it('rejects malformed non-ASCII cookie values without throwing', async () => {
    const state = await setup();
    const cookieName = state.cookie.split('=')[0];
    const malformed = `${cookieName}=${'é'.repeat(64)}`;
    expect((await fetch(state.api, { headers: { Cookie: malformed } })).status).toBe(403);
    const socket = new WebSocket(state.origin.replace('http:', 'ws:'), {
      headers: { Cookie: malformed },
    });
    await new Promise<void>(resolve => {
      socket.once('error', () => resolve());
      socket.once('open', () => {
        socket.close();
        resolve();
      });
    });
    expect(socket.readyState).not.toBe(WebSocket.OPEN);
    expect(mock.request).toHaveBeenCalledTimes(1);
  });

  it('closes its listener and aborts outstanding requests when the owner closes', async () => {
    const state = await setup();
    state.currentOwner.emit('destroyed');
    await expect(fetch(state.api, { headers: { Cookie: state.cookie } })).rejects.toThrow();
  });

  it('refuses localOnly plugins before creating a browser session', async () => {
    mock.request.mockResolvedValueOnce(
      Response.json({
        plugins: [
          { manifest: { id: 'sample', localOnly: true, control: { path: 'control.html' } } },
        ],
      }),
    );
    await expect(openRemotePluginControl(params, 'sample', owner())).rejects.toThrow('локально');
    expect(mock.open).not.toHaveBeenCalled();
  });

  it('relays scoped event stream messages through a read-only WebSocket', async () => {
    const state = await setup();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    mock.request.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            stream = controller;
          },
          cancel,
        }),
      ),
    );
    const socket = new WebSocket(state.origin.replace('http:', 'ws:'), {
      headers: { Cookie: state.cookie, Origin: state.origin },
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    await vi.waitFor(() =>
      expect(mock.request.mock.calls.at(-1)?.[0].api).toBe(
        '/manage/v1/plugins/sample/control/events',
      ),
    );
    const nextMessage = new Promise<string>(resolve =>
      socket.once('message', value => resolve(value.toString())),
    );
    const message = JSON.stringify({ event: 'plugin:sample:changed', data: [{ value: 2 }] });
    stream.enqueue(new TextEncoder().encode(`${message}\n`));
    expect(await nextMessage).toBe(message);
    socket.send(JSON.stringify({ command: 'delete-everything' }));
    expect(mock.request).toHaveBeenCalledTimes(2);
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    state.currentOwner.emit('destroyed');
    stream.close();
    await closed;
  });
});
