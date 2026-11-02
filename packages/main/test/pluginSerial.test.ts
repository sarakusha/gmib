import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ ports: [] as any[], created: [] as any[], respond: true }));
vi.mock('serialport', () => ({
  SerialPort: class extends EventEmitter {
    static list = async () => mock.ports;
    isOpen = false;
    constructor(public options: unknown) {
      super();
      mock.created.push(this);
    }
    open(callback: (error?: Error) => void) {
      this.isOpen = true;
      callback();
    }
    close(callback: () => void) {
      this.isOpen = false;
      this.emit('close');
      callback();
    }
    write(data: string, callback: (error?: Error) => void) {
      callback();
      if (mock.respond) queueMicrotask(() => this.emit('data', Buffer.from(`#OK,${data}`)));
    }
  },
}));
import { createPluginSerial } from '../src/pluginSerial';
const manifest = {
  id: 'test',
  name: 'Test',
  version: '1.0.0',
  gmibApi: '^1.3.0',
  permissions: ['serial.control'] as ['serial.control'],
};
const options = { path: 'COM1', baudRate: 9600, vendorId: '04d8', productId: '000a' };
beforeEach(() => {
  mock.ports = [{ path: 'COM1', vendorId: '04d8', productId: '000a' }];
  mock.created = [];
  mock.respond = true;
});
it('checks permissions and current USB identity', async () => {
  const api = createPluginSerial({ ...manifest, permissions: [] }, () => {});
  await expect(api.list()).rejects.toThrow('permission');
  const allowed = createPluginSerial(manifest, () => {});
  await expect(allowed.open({ ...options, productId: 'ffff' })).rejects.toThrow('identity');
});
it('owns port exclusively, frames requests, and disposes resources', async () => {
  let dispose = async () => {};
  const api = createPluginSerial(manifest, fn => {
    dispose = async () => {
      await fn();
    };
  });
  const connection = await api.open(options);
  await expect(api.open(options)).rejects.toThrow('owned');
  await expect(connection.request('$KE,SER', '#OK')).resolves.toBe('#OK,$KE,SER');
  await expect(connection.request('bad\r\ncommand', '#OK')).rejects.toThrow('Invalid');
  await dispose();
  expect(mock.created[0].isOpen).toBe(false);
  await expect(api.list()).rejects.toThrow('disposed');
  const other = createPluginSerial(manifest, () => {});
  const reopened = await other.open(options);
  await reopened.close();
});
it('timeout closes connection so a late reply cannot satisfy another request', async () => {
  vi.useFakeTimers();
  mock.respond = false;
  const api = createPluginSerial(manifest, () => {});
  const connection = await api.open(options);
  const request = connection.request('$KE,SER', '#SER');
  const failed = expect(request).rejects.toThrow('timeout');
  await vi.advanceTimersByTimeAsync(2001);
  await failed;
  expect(mock.created[0].isOpen).toBe(false);
  await expect(connection.request('$KE,SER', '#SER')).rejects.toThrow('closed');
  vi.useRealTimers();
});
