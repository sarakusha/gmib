import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { isIPv4 } from 'node:net';
import { join } from 'node:path';
import readline from 'node:readline';

import type bonjourHap from 'bonjour-hap';

type AdvertisementEvents = {
  up: [];
  error: [error: Error];
};

type BrowserEvents = {
  up: [service: bonjourHap.RemoteService];
  down: [service: bonjourHap.RemoteService];
  update: [service: bonjourHap.RemoteService];
  error: [error: Error];
};

const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
export const dnsSdPath = join(systemRoot, 'System32', 'dns-sd.exe');
const serviceControllerPath = join(systemRoot, 'System32', 'sc.exe');

export const isBonjourServiceRunning = (status: string): boolean => /\bRUNNING\b/.test(status);

export const isSystemBonjourAvailable = (): boolean => {
  if (process.platform !== 'win32' || !existsSync(dnsSdPath)) return false;
  const result = spawnSync(serviceControllerPath, ['query', 'Bonjour Service'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 && isBonjourServiceRunning(result.stdout);
};

const serviceType = (type: string, protocol = 'tcp'): string => `_${type}._${protocol}`;

const stopProcess = (child: ChildProcessWithoutNullStreams | undefined): void => {
  if (child && child.exitCode == null && !child.killed) child.kill();
};

const readLines = (
  child: ChildProcessWithoutNullStreams,
  listener: (line: string) => void,
): void => {
  readline.createInterface({ input: child.stdout }).on('line', listener);
  readline.createInterface({ input: child.stderr }).on('line', listener);
};

const unescapeDnsSdValue = (value: string): string => value.replace(/\\(.)/g, '$1');

export const parseDnsSdTxt = (line: string): Record<string, string> => {
  const txt: Record<string, string> = {};
  for (const token of line.match(/(?:\\.|\S)+/g) ?? []) {
    const separator = token.indexOf('=');
    if (separator <= 0) continue;
    txt[token.slice(0, separator).toLowerCase()] = unescapeDnsSdValue(token.slice(separator + 1));
  }
  return txt;
};

export const parseBrowseLine = (
  line: string,
  expectedType: string,
): { event: 'up' | 'down'; name: string; domain: string } | undefined => {
  const marker = ` ${expectedType}.`;
  const markerIndex = line.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const prefix = line.slice(0, markerIndex).trim().split(/\s+/);
  const action = prefix.find(part => part === 'Add' || part === 'Rmv');
  const domain = prefix.at(-1);
  const name = line.slice(markerIndex + marker.length).trim();
  if (!action || !domain || !name) return undefined;
  return { event: action === 'Add' ? 'up' : 'down', name, domain };
};

export const parseResolveLine = (line: string): { host: string; port: number } | undefined => {
  const match = line.match(/ can be reached at (.+):([0-9]+) \(interface [0-9]+\)$/);
  if (!match) return undefined;
  return { host: match[1], port: Number(match[2]) };
};

class SystemAdvertisement extends EventEmitter<AdvertisementEvents> {
  #child: ChildProcessWithoutNullStreams | undefined;
  #txt: Record<string, string>;
  #active = false;

  constructor(private readonly options: bonjourHap.ServiceOptions) {
    super();
    this.#txt = options.txt ?? {};
    this.start();
  }

  start(): void {
    if (this.#active) return;
    this.#active = true;
    const args = [
      '-R',
      this.options.name,
      serviceType(this.options.type, this.options.protocol),
      'local.',
      String(this.options.port),
      ...Object.entries(this.#txt).map(([key, value]) => `${key}=${value}`),
    ];
    const child = spawn(dnsSdPath, args, { windowsHide: true });
    this.#child = child;
    let announced = false;
    readLines(child, line => {
      if (!announced && /registered and active/i.test(line)) {
        announced = true;
        this.emit('up');
      }
    });
    child.once('error', error => {
      if (this.listenerCount('error') > 0) this.emit('error', error);
    });
    child.once('exit', () => {
      if (this.#child === child) this.#child = undefined;
    });
  }

  stop(callback?: () => void): void {
    this.#active = false;
    const child = this.#child;
    this.#child = undefined;
    if (!child || child.exitCode != null || child.killed) {
      callback?.();
      return;
    }
    child.once('exit', () => callback?.());
    child.kill();
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }

  updateTxt(txt: Record<string, string>): void {
    this.#txt = txt;
    if (!this.#active) return;
    this.stop(() => this.start());
  }
}

class SystemBrowser extends EventEmitter<BrowserEvents> {
  readonly services: bonjourHap.RemoteService[] = [];
  readonly #resolvers = new Map<string, ChildProcessWithoutNullStreams>();
  #browser: ChildProcessWithoutNullStreams | undefined;
  #active = false;

  constructor(private readonly options: bonjourHap.BrowserOptions) {
    super();
    this.start();
  }

  start(): void {
    if (this.#active || !this.options.type) return;
    this.#active = true;
    const type = serviceType(this.options.type, this.options.protocol);
    const child = spawn(dnsSdPath, ['-B', type, 'local.'], { windowsHide: true });
    this.#browser = child;
    readLines(child, line => {
      const event = parseBrowseLine(line, type);
      if (!event) return;
      const fqdn = `${event.name}.${type}.${event.domain}`;
      if (event.event === 'down') {
        stopProcess(this.#resolvers.get(fqdn));
        this.#resolvers.delete(fqdn);
        const index = this.services.findIndex(service => service.fqdn === fqdn);
        if (index >= 0) this.emit('down', this.services.splice(index, 1)[0]);
        return;
      }
      this.#resolve(event.name, type, event.domain, fqdn);
    });
    child.once('error', error => {
      if (this.listenerCount('error') > 0) this.emit('error', error);
    });
    child.once('exit', () => {
      if (this.#browser !== child) return;
      this.#browser = undefined;
      if (this.#active) setTimeout(() => this.#restart(), 1000).unref();
    });
  }

  stop(): void {
    this.#active = false;
    stopProcess(this.#browser);
    this.#browser = undefined;
    this.#resolvers.forEach(stopProcess);
    this.#resolvers.clear();
  }

  update(): void {
    // DNSServiceBrowse remains subscribed and receives additions/removals immediately.
  }

  #restart(): void {
    if (!this.#active) return;
    this.#active = false;
    this.start();
  }

  #resolve(name: string, type: string, domain: string, fqdn: string): void {
    if (this.#resolvers.has(fqdn)) return;
    const child = spawn(dnsSdPath, ['-L', name, type, domain], { windowsHide: true });
    this.#resolvers.set(fqdn, child);
    let resolved: { host: string; port: number } | undefined;
    readLines(child, line => {
      resolved = parseResolveLine(line) ?? resolved;
      if (!resolved || !line.includes('=')) return;
      const txt = parseDnsSdTxt(line);
      this.#resolveAddresses(resolved.host, addresses => {
        if (addresses.length === 0 || !this.#resolvers.has(fqdn)) return;
        const service: bonjourHap.RemoteService = {
          name,
          fqdn,
          host: resolved!.host,
          port: resolved!.port,
          type: this.options.type!,
          protocol: this.options.protocol ?? 'tcp',
          subtypes: this.options.subtypes ?? [],
          txt,
          referer: { address: addresses[0], family: 'IPv4', port: 5353, size: 0 },
          rawTxt: Buffer.from(line),
          addresses,
        };
        const index = this.services.findIndex(current => current.fqdn === fqdn);
        if (index >= 0) {
          this.services[index] = service;
          this.emit('update', service);
        } else {
          this.services.push(service);
          this.emit('up', service);
        }
      });
    });
    child.once('exit', () => {
      if (this.#resolvers.get(fqdn) === child) this.#resolvers.delete(fqdn);
    });
  }

  #resolveAddresses(host: string, callback: (addresses: string[]) => void): void {
    const child = spawn(dnsSdPath, ['-G', 'v4', host], { windowsHide: true });
    const addresses = new Set<string>();
    let timer: NodeJS.Timeout | undefined;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stopProcess(child);
      callback([...addresses]);
    };
    readLines(child, line => {
      for (const token of line.trim().split(/\s+/)) {
        if (isIPv4(token) && token !== '0.0.0.0') addresses.add(token);
      }
      if (addresses.size > 0) {
        clearTimeout(timer);
        timer = setTimeout(finish, 250);
      }
    });
    child.once('error', finish);
    timer = setTimeout(finish, 3000);
    timer.unref();
  }
}

export const createSystemBonjour = () => {
  const advertisements = new Set<SystemAdvertisement>();
  const browsers = new Set<SystemBrowser>();
  return {
    publish: (options: bonjourHap.ServiceOptions) => {
      const advertisement = new SystemAdvertisement(options);
      advertisements.add(advertisement);
      return advertisement;
    },
    find: (options: bonjourHap.BrowserOptions) => {
      const browser = new SystemBrowser(options);
      browsers.add(browser);
      return browser;
    },
    destroy: (callback?: () => void) => {
      advertisements.forEach(advertisement => advertisement.destroy());
      browsers.forEach(browser => browser.stop());
      advertisements.clear();
      browsers.clear();
      callback?.();
    },
  };
};
