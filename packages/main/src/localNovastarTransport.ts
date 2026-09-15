import fs from 'node:fs';
import { isIPv4 } from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

type Interfaces = ReturnType<typeof networkInterfaces>;

export const isIPv4LinkLocal = (address: string): boolean =>
  isIPv4(address) && address.startsWith('169.254.');

export const hasLocalNovastarTransport = (
  interfaces: Interfaces = networkInterfaces(),
  driverPath = (name: string): string =>
    fs.realpathSync(path.join('/sys/class/net', name, 'device/driver')),
  platform = process.platform,
): boolean =>
  Object.entries(interfaces).some(([name, addresses]) => {
    if (addresses?.some(({ address }) => isIPv4LinkLocal(address))) return true;
    if (platform !== 'linux') return false;
    try {
      return path.basename(driverPath(name)) === 'rndis_host';
    } catch {
      return false;
    }
  });
