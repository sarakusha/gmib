import { SerialPort } from 'serialport';
import type { PluginManifest } from '/@common/plugins';
import type {
  PluginSerialApi,
  PluginSerialConnection,
  PluginSerialDevice,
} from '/@common/pluginSerial';

const owners = new Set<string>();
export const createPluginSerial = (
  manifest: PluginManifest,
  addDisposer: (dispose: () => void | Promise<void>) => void,
): PluginSerialApi => {
  let disposed = false;
  const connections = new Set<PluginSerialConnection>();
  const opening = new Set<Promise<void>>();
  const check = () => {
    if (disposed) throw new Error('Plugin disposed');
    if (!manifest.permissions?.includes('serial.control'))
      throw new Error('Missing serial.control permission');
  };
  addDisposer(async () => {
    disposed = true;
    await Promise.allSettled([...opening]);
    await Promise.allSettled([...connections].map(connection => connection.close()));
  });
  return {
    async list() {
      check();
      return SerialPort.list();
    },
    async open(options) {
      check();
      if (
        !options ||
        !Number.isInteger(options.baudRate) ||
        options.baudRate < 300 ||
        options.baudRate > 1000000
      )
        throw new Error('Invalid serial options');
      const device = ((await SerialPort.list()) as PluginSerialDevice[]).find(
        item => item.path === options.path,
      );
      if (
        !device ||
        !options.vendorId ||
        !options.productId ||
        device.vendorId?.toLowerCase() !== options.vendorId.toLowerCase() ||
        device.productId?.toLowerCase() !== options.productId.toLowerCase()
      )
        throw new Error('USB device identity mismatch');
      check();
      if (owners.has(device.path)) throw new Error('Serial port already owned by a plugin');
      const port = new SerialPort({
        path: device.path,
        baudRate: options.baudRate,
        autoOpen: false,
      });
      owners.add(device.path);
      let closed = false;
      let pending:
        | { reject: (error: Error) => void; resolve: (line: string) => void; prefix: string }
        | undefined;
      let buffer = '';
      let queue: Promise<unknown> = Promise.resolve();
      const fail = (error: Error) => {
        pending?.reject(error);
        pending = undefined;
      };
      port.on('error', fail);
      port.on('close', () => {
        closed = true;
        connections.delete(connection);
        owners.delete(device.path);
        fail(new Error('Serial port disconnected'));
      });
      port.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('ascii');
        if (buffer.length > 8192) {
          buffer = '';
          fail(new Error('Serial response too large'));
          return;
        }
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (pending && (line.startsWith(pending.prefix) || line.startsWith('#ERR')))
            pending.resolve(line);
        }
      });
      const connection: PluginSerialConnection = {
        async close() {
          if (closed) return;
          closed = true;
          fail(new Error('Serial connection closed'));
          await new Promise<void>(resolve => {
            if (port.isOpen) port.close(() => resolve());
            else resolve();
          });
          owners.delete(device.path);
          connections.delete(connection);
        },
        request(command, responsePrefix) {
          const result = queue.then(async () => {
            check();
            if (closed || !port.isOpen) throw new Error('Serial connection closed');
            if (
              typeof command !== 'string' ||
              command.length > 512 ||
              [...command].some(character => character.charCodeAt(0) < 32) ||
              !responsePrefix ||
              /[\r\n]/.test(responsePrefix)
            )
              throw new Error('Invalid serial request');
            try {
              return await new Promise<string>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Serial response timeout')), 2000);
                pending = {
                  prefix: responsePrefix,
                  resolve: line => {
                    clearTimeout(timer);
                    pending = undefined;
                    resolve(line);
                  },
                  reject: error => {
                    clearTimeout(timer);
                    pending = undefined;
                    reject(error);
                  },
                };
                port.write(`${command}\r\n`, error => {
                  if (error) pending?.reject(error);
                });
              });
            } catch (error) {
              await connection.close();
              throw error;
            }
          });
          queue = result.catch(() => {});
          return result;
        },
      };
      try {
        const opened = new Promise<void>((resolve, reject) =>
          port.open(error => (error ? reject(error) : resolve())),
        );
        opening.add(opened);
        try {
          await opened;
        } finally {
          opening.delete(opened);
        }
        if (disposed) {
          await connection.close();
          throw new Error('Plugin disposed');
        }
        connections.add(connection);
        return connection;
      } catch (error) {
        owners.delete(device.path);
        throw error;
      }
    },
  };
};
