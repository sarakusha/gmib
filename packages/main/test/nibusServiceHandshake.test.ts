import { createRequire } from 'node:module';
import net, { type Socket } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NibusService as ESMNibusService } from '@nibus/service';

interface TestSerial {
  addConnection(socket: Socket): void;
  close(): Promise<void>;
}

interface TestServer {
  listen(port: number, host?: string): Promise<void>;
  close(): Promise<void>;
  readonly path: string;
  ports: Record<string, TestSerial>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

interface TestService {
  server: TestServer;
}

type ServiceConstructor = new (options: { discovery: false }) => TestService;

const require = createRequire(import.meta.url);
const { NibusService: CJSNibusService } = require('@nibus/service') as {
  NibusService: ServiceConstructor;
};
const implementations: Array<[string, ServiceConstructor]> = [
  ['ESM', ESMNibusService as unknown as ServiceConstructor],
  ['CJS', CJSNibusService],
];
const existingSignalListeners = new Map(
  (['SIGINT', 'SIGTERM'] as const).map(signal => [signal, new Set(process.listeners(signal))]),
);

const listen = async (server: TestServer): Promise<number> => {
  await server.listen(0, '127.0.0.1');
  return Number((JSON.parse(server.path) as { port: number }).port);
};

const connect = async (port: number): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });

const nextEvent = (socket: Socket, eventName: string): Promise<unknown[]> =>
  new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => {
      socket.off('data', onData);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, 1000);
    const onData = (data: Buffer): void => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        const message = JSON.parse(line) as { event: string; args: unknown[] };
        if (message.event === eventName) {
          clearTimeout(timeout);
          socket.off('data', onData);
          resolve(message.args);
          return;
        }
      }
    };
    socket.on('data', onData);
  });

describe.each(implementations)('%s IPC handshake', (_format, Service) => {
  let server: TestServer | undefined;
  let clients: Socket[] = [];

  afterEach(async () => {
    clients.forEach(client => client.destroy());
    clients = [];
    await server?.close();
    server = undefined;
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const baseline = existingSignalListeners.get(signal)!;
      process.listeners(signal).forEach(listener => {
        if (!baseline.has(listener)) process.off(signal, listener);
      });
    }
  });

  const startServer = async (): Promise<number> => {
    server = new Service({ discovery: false }).server;
    return listen(server);
  };

  it('parses a ping coalesced with the NIBUS handshake', async () => {
    const port = await startServer();
    const client = await connect(port);
    clients.push(client);
    const pong = nextEvent(client, 'pong');

    client.write(
      Buffer.concat([Buffer.from('NIBUS'), Buffer.from('{"event":"ping","args":[]}\n')]),
    );

    await expect(pong).resolves.toEqual([]);
  });

  it('buffers a fragmented NIBUS handshake and parses its trailing ping', async () => {
    const port = await startServer();
    const client = await connect(port);
    clients.push(client);
    const pong = nextEvent(client, 'pong');

    client.write('NI');
    await new Promise(resolve => setTimeout(resolve, 20));
    client.write('BUS{"event":"ping","args":[]}\n');

    await expect(pong).resolves.toEqual([]);
  });

  it('keeps the legacy exact raw serial preamble route', async () => {
    const port = await startServer();
    const received: Buffer[] = [];
    const addConnection = vi.fn((socket: Socket) => {
      socket.on('data', data => received.push(data));
    });
    server!.ports['COM7'] = { addConnection, close: async () => {} };
    const connection = vi.fn();
    server!.on('connection', connection);
    const client = await connect(port);
    clients.push(client);

    client.write('COM7');
    await vi.waitFor(() => expect(addConnection).toHaveBeenCalledOnce());
    const serialBytes = Buffer.from([0x00, 0x80, 0xff, 0x7f]);
    client.write(serialBytes);
    await vi.waitFor(() => expect(Buffer.concat(received)).toEqual(serialBytes));
    expect(connection).not.toHaveBeenCalled();
  });

  it('keeps fragmented JSON tails isolated between clients', async () => {
    const port = await startServer();
    const first = await connect(port);
    const second = await connect(port);
    clients.push(first, second);
    first.write('NIBUS');
    second.write('NIBUS');
    await new Promise(resolve => setTimeout(resolve, 20));

    const firstPong = nextEvent(first, 'pong');
    const secondPong = nextEvent(second, 'pong');
    first.write('{"event":"ping","args"');
    second.write('{"event":"ping","args":[]}\n');
    await expect(secondPong).resolves.toEqual([]);
    first.write(':[]}\n');
    await expect(firstPong).resolves.toEqual([]);
  });
});
