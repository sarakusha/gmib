import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';

import {
  findDeviceById,
  getNibusSession,
  getSessions,
  NibusSession,
} from '@nibus/core/session/NibusSession';
import type { DeviceId } from '@nibus/core';
import { waitForSessionReady } from './sessionConnection';

const listen = async (server: net.Server): Promise<number> => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as net.AddressInfo).port;
};

const closeServer = async (server: net.Server): Promise<void> => {
  await new Promise<void>(resolve => server.close(() => resolve()));
};

describe('session connection startup', () => {
  let server: net.Server | undefined;
  let session: NibusSession | undefined;

  afterEach(async () => {
    session?.close();
    session = undefined;
    if (server?.listening) await closeServer(server);
    server = undefined;
  });

  it('waits for a real ports snapshot and heartbeat, including a zero-port host', async () => {
    server = net.createServer(socket => {
      let buffer = '';
      let initialized = false;
      socket.on('data', data => {
        buffer += data.toString();
        if (!initialized && buffer.includes('NIBUS')) {
          initialized = true;
          buffer = buffer.replace('NIBUS', '');
          socket.write('{"event":"ports","args":[[]]}\n');
          socket.write('{"event":"config","args":[{"disableNet":false}]}\n');
        }
        const messages = buffer.split('\n');
        buffer = messages.pop() ?? '';
        if (messages.some(line => line.includes('"ping"'))) {
          socket.write('{"event":"pong","args":[]}\n');
        }
      });
    });
    const port = await listen(server);
    session = new NibusSession(port, '127.0.0.1');
    const config = new Promise<unknown>(resolve => session!.once('config', resolve));
    const abort = new AbortController();

    await expect(waitForSessionReady(session, abort.signal, 4000)).resolves.toBe(0);
    await expect(config).resolves.toEqual({ disableNet: false });
    expect(session.ports).toBe(0);
  });

  it('closes a stalled TCP session and succeeds after the service responds on retry', async () => {
    let connections = 0;
    server = net.createServer(socket => {
      const attempt = ++connections;
      let buffer = '';
      socket.on('data', data => {
        buffer += data.toString();
        if (attempt > 1 && buffer.includes('NIBUS')) {
          socket.write('{"event":"ports","args":[[]]}\n');
          socket.write('{"event":"config","args":[{"retry":true}]}\n');
          buffer = buffer.replace('NIBUS', '');
        }
        if (attempt > 1 && buffer.includes('"ping"')) {
          socket.write('{"event":"pong","args":[]}\n');
          buffer = '';
        }
      });
    });
    const port = await listen(server);
    session = new NibusSession(port, '127.0.0.1');
    const firstAbort = new AbortController();

    await expect(waitForSessionReady(session, firstAbort.signal, 30)).rejects.toThrow(/timed out/i);
    expect(connections).toBe(1);

    const secondAbort = new AbortController();
    await expect(waitForSessionReady(session, secondAbort.signal, 4000)).resolves.toBe(0);
    expect(connections).toBe(2);
  });

  it('times out when ports and config arrive without a heartbeat pong', async () => {
    server = net.createServer(socket => {
      socket.on('data', data => {
        if (data.toString().includes('NIBUS')) {
          socket.write('{"event":"ports","args":[[]]}\n');
          socket.write('{"event":"config","args":[{}]}\n');
        }
      });
    });
    const port = await listen(server);
    session = new NibusSession(port, '127.0.0.1');

    await expect(waitForSessionReady(session, new AbortController().signal, 50)).rejects.toThrow(
      /timed out/i,
    );
  });

  it('times out when ports and pong arrive without config', async () => {
    server = net.createServer(socket => {
      let buffer = '';
      socket.on('data', data => {
        buffer += data.toString();
        if (buffer.includes('NIBUS')) {
          socket.write('{"event":"ports","args":[[]]}\n');
          buffer = buffer.replace('NIBUS', '');
        }
        if (buffer.includes('"ping"')) {
          socket.write('{"event":"pong","args":[]}\n');
          buffer = '';
        }
      });
    });
    const port = await listen(server);
    session = new NibusSession(port, '127.0.0.1');

    await expect(waitForSessionReady(session, new AbortController().signal, 1500)).rejects.toThrow(
      /timed out/i,
    );
  });

  it('reconnects the same managed session and registers it for device lookup', async () => {
    server = net.createServer(socket => {
      let buffer = '';
      socket.on('data', data => {
        buffer += data.toString();
        if (buffer.includes('NIBUS')) {
          socket.write('{"event":"ports","args":[[]]}\n');
          socket.write('{"event":"config","args":[{}]}\n');
          buffer = buffer.replace('NIBUS', '');
        }
        if (buffer.includes('"ping"')) {
          socket.write('{"event":"pong","args":[]}\n');
          buffer = '';
        }
      });
    });
    const port = await listen(server);
    session = getNibusSession(port, '127.0.0.1') as NibusSession;
    const syntheticDevice = { id: 'test-device' as DeviceId };
    session.devices.findById = id =>
      (id === syntheticDevice.id ? syntheticDevice : undefined) as never;
    const onlineEvents: boolean[] = [];
    session.on('online', value => onlineEvents.push(value));

    await waitForSessionReady(session, new AbortController().signal, 4000);
    expect(getSessions()).toContain(session);
    expect(findDeviceById(syntheticDevice.id)).toBe(syntheticDevice);
    session.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getSessions()).not.toContain(session);

    await waitForSessionReady(session, new AbortController().signal, 4000);
    expect(getSessions()).toContain(session);
    expect(onlineEvents.filter(Boolean)).toHaveLength(2);
  });

  it('cancels a pending attempt and closes its accepted socket', async () => {
    let socketClosed: (() => void) | undefined;
    const closed = new Promise<void>(resolve => {
      socketClosed = resolve;
    });
    server = net.createServer(socket => {
      socket.on('data', () => undefined);
      socket.once('close', () => socketClosed?.());
    });
    const port = await listen(server);
    session = new NibusSession(port, '127.0.0.1');
    const controller = new AbortController();
    const pending = waitForSessionReady(session, controller.signal, 4000);
    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort();

    await expect(pending).rejects.toThrow(/cancelled/i);
    await expect(closed).resolves.toBeUndefined();
  });
});
