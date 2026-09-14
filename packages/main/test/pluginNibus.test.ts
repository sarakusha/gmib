import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  handlers: new Map<string, Array<(...args: unknown[]) => void>>(),
  send: vi.fn(async () => undefined),
}));
vi.mock('@nibus/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@nibus/core')>();
  const session = {
    on: (name: string, fn: (...args: unknown[]) => void) => {
      mock.handlers.set(name, [...(mock.handlers.get(name) ?? []), fn]);
      return session;
    },
    once: (name: string, fn: (...args: unknown[]) => void) => session.on(name, fn),
    start: async () => 0,
    close: () => mock.handlers.get('close')?.forEach(fn => fn()),
  };
  return { ...actual, getNibusSession: () => session };
});
import { createPluginNibus } from '../src/pluginNibus';
const manifest = {
  id: 'test',
  name: 'test',
  version: '1.0.0',
  gmibApi: '^1.1.0',
  permissions: ['nibus.read', 'nibus.write'] as const,
};

afterEach(() => {
  vi.useRealTimers();
  mock.handlers.clear();
  mock.send.mockClear();
});
describe('plugin NiBUS ownership and queues', () => {
  it('coalesces stale values, owns a connection exclusively and resends after reconnect', async () => {
    vi.useFakeTimers();
    const cleanup: Array<() => void | Promise<void>> = [];
    const api = createPluginNibus({ ...manifest, permissions: [...manifest.permissions] }, fn =>
      cleanup.push(fn),
    );
    await api.listConnections();
    const connection = { path: 'test-port', isClosed: false, sendDatagram: mock.send };
    mock.handlers.get('add')?.forEach(fn => fn(connection));
    expect(await api.listConnections()).toEqual([{ id: 'test-port', name: 'test-port' }]);
    const output = await api.acquireOutput({
      connectionId: 'test-port',
      target: 'FF:FF:FF:FF:FF:FF',
      profile: 'matchpad',
    });
    expect(() =>
      api.acquireOutput({
        connectionId: 'test-port',
        target: '01:02:03:04:05:06',
        profile: 'matchpad',
      }),
    ).toThrow(/уже/);
    await output.sendScoreboard({ home: 1, away: 0, period: 1 });
    await output.sendScoreboard({ home: 2, away: 0, period: 1 });
    await vi.advanceTimersByTimeAsync(110);
    expect(mock.send).toHaveBeenCalledTimes(3);
    expect(mock.send.mock.calls[0][0]).toMatchObject({ id: 6 });
    expect(mock.send.mock.calls[0][0].nms.readUInt16LE(1)).toBe(2);
    mock.send.mockClear();
    mock.handlers.get('remove')?.forEach(fn => fn(connection));
    await output.sendScoreboard({ home: 3, away: 1, period: 2 });
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.send).not.toHaveBeenCalled();
    mock.handlers.get('add')?.forEach(fn => fn({ ...connection }));
    await vi.advanceTimersByTimeAsync(110);
    expect(mock.send).toHaveBeenCalledTimes(3);
    await output.release();
    expect(() => output.sendScoreboard({ home: 4, away: 1, period: 2 })).toThrow(/освобождён/);
    for (const dispose of cleanup.reverse()) await dispose();
  });
});
