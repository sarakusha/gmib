import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLinuxTaurusAutomaticCommand,
  buildLinuxTaurusRouteCommand,
  classifyLinuxTaurusProtection,
  getLinuxTaurusDefaultRoutes,
  inspectLinuxTaurusRoutes,
  repairLinuxTaurusRoutes,
} from '../src/linuxTaurusRoutes';

const { lstat, readdir, readFile, realpath, run } = vi.hoisted(() => ({
  lstat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
  run: vi.fn(),
}));
vi.mock('node:fs/promises', () => ({ lstat, readdir, readFile, realpath }));
vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: (
    file: string,
    args: string[],
    options: unknown,
    callback: (error: unknown, stdout?: string) => void,
  ) => {
    void (async () => {
      try {
        callback(null, (await run(file, args, options)).stdout);
      } catch (error) {
        callback(error);
      }
    })();
  },
}));

const rndis = {
  match: { driver: 'rndis_host' },
  dhcp4: true,
  'dhcp4-overrides': { 'use-routes': false, 'use-dns': false },
};
const kiosk = {
  network: {
    ethernets: {
      wired: { match: { name: 'e*' }, dhcp4: true },
      'taurus-rndis': rndis,
    },
  },
};
const iface = { name: 'enp0s1u2' };

describe('Linux Taurus route classification', () => {
  it('recognizes the kiosk rule when the subsequent wired rule also matches', () => {
    expect(classifyLinuxTaurusProtection(kiosk, iface)).toBe('enabled');
  });

  it('checks the networkd profile which matches first', () => {
    const config = {
      network: {
        ethernets: { ...kiosk.network.ethernets, 'first-wired': kiosk.network.ethernets.wired },
      },
    };
    expect(classifyLinuxTaurusProtection(config, iface)).toBe('missing');
  });

  it('requires both DHCP overrides on the selected interface', () => {
    const config = {
      network: {
        ethernets: {
          other: rndis,
          enp0s1u2: {
            dhcp4: true,
            'dhcp4-overrides': { 'use-routes': false },
          },
        },
      },
    };
    expect(classifyLinuxTaurusProtection(config, iface)).toBe('missing');
    expect(classifyLinuxTaurusProtection({ network: {} }, iface)).toBe('missing');
  });

  it('treats unavailable config and ambiguous renderer matches as unknown', () => {
    expect(classifyLinuxTaurusProtection(undefined, iface)).toBe('unknown');
    expect(
      classifyLinuxTaurusProtection(
        { network: { renderer: 'NetworkManager', ...kiosk.network } },
        iface,
      ),
    ).toBe('unknown');
  });

  it('uses driver and permanent MAC together while ignoring rules for unrelated adapters', () => {
    const macaddress = 'ab:cd:ef:12:34:56';
    const config = {
      network: {
        ethernets: {
          first: { match: { driver: 'cdc_ether', macaddress }, dhcp4: true },
          taurus: { ...rndis, match: { driver: ['cdc_ether', 'rndis_*'], macaddress } },
        },
      },
    };
    expect(classifyLinuxTaurusProtection(config, { ...iface, permanentMac: macaddress })).toBe(
      'enabled',
    );
    expect(classifyLinuxTaurusProtection(config, iface)).toBe('unknown');
    expect(
      classifyLinuxTaurusProtection(config, { ...iface, permanentMac: 'aa:bb:cc:dd:ee:ff' }),
    ).toBe('missing');
  });

  it('selects default routes through the adapter, including policy-table and multipath routes', () => {
    expect(
      getLinuxTaurusDefaultRoutes(
        [
          { dst: 'default', dev: 'wlan0', gateway: '10.0.0.1', metric: 1 },
          { dst: '192.168.2.0/24', dev: iface.name },
          { dst: 'default', dev: iface.name, gateway: '192.168.2.1', metric: 100 },
          { dst: '0.0.0.0/0', table: 200, nexthops: [{ dev: iface.name }, { dev: 'wlan0' }] },
        ],
        iface.name,
      ),
    ).toEqual([
      { nextHop: '192.168.2.1', metric: 100, table: 'main' },
      { nextHop: '0.0.0.0', metric: 0, table: '200' },
    ]);
  });
});

function shellArguments(command: string): string[] {
  const result = spawnSync('/bin/sh', ['-c', `sudo() { printf '%s\\000' "$@"; }; ${command}`], {
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  return result.stdout.split('\0');
}

function mockAdapter(name: string, serial: string, driver = 'rndis_host', product = '0013') {
  const netDir = '/sys/class/net';
  const usbDevice = `/sys/devices/usb1/${name}`;
  const device = `${usbDevice}/usb-interface`;
  readdir.mockResolvedValue([name]);
  realpath.mockImplementation(async (file: string) => {
    if (file === `${netDir}/${name}/device`) return device;
    if (file === `${device}/driver`) return `/sys/bus/usb/drivers/${driver}`;
    throw new Error('Missing sysfs link');
  });
  readFile.mockImplementation(async (file: string) => {
    const attributes: Record<string, string> = {
      [`${netDir}/${name}/ifindex`]: '17\n',
      [`${device}/uevent`]: 'DEVTYPE=usb_interface\n',
      [`${usbDevice}/uevent`]: 'DEVTYPE=usb_device\n',
      [`${usbDevice}/idVendor`]: '2207',
      [`${usbDevice}/idProduct`]: product,
      [`${usbDevice}/serial`]: serial,
      '/sys/devices/usb1/uevent': 'DEVTYPE=usb_device\n',
      '/sys/devices/usb1/serial': 'HubSerial',
    };
    if (!(file in attributes)) throw new Error('Missing sysfs attribute');
    return attributes[file];
  });
}

describe('Linux Taurus route inspection and command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lstat.mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
  });

  it('reports a live default route even when the Netplan protection is configured', async () => {
    mockAdapter(iface.name, 'A0005306');
    run
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ dst: 'default', dev: iface.name, gateway: '192.168.2.1' }]),
      })
      .mockResolvedValueOnce({ stdout: JSON.stringify(kiosk) });

    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      platform: 'linux',
      adapters: [
        {
          deviceId: 'usb:2207:0013:A0005306',
          interfaceAlias: iface.name,
          protection: 'enabled',
          autoEnabled: false,
          defaultRoutes: [{ nextHop: '192.168.2.1', metric: 0, table: 'main' }],
        },
      ],
    });
  });

  it('preserves the adapter when Netplan cannot be read', async () => {
    mockAdapter(iface.name, 'A0005306');
    run
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockRejectedValueOnce(new Error('Permission denied'));

    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      diagnostic: expect.any(String),
      adapters: [{ serialNumber: 'A0005306', protection: 'unknown' }],
    });
  });

  it('distinguishes absent, staged and inaccessible Netplan policy state', async () => {
    mockAdapter(iface.name, 'A0005306');
    run
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: JSON.stringify(kiosk) });
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      adapters: [{ autoEnabled: false }],
    });

    const readAttribute = readFile.getMockImplementation()!;
    lstat.mockResolvedValue({ isFile: () => true, uid: 0, mode: 0o600 });
    readFile.mockImplementation(async (file: string) => {
      if (file.endsWith('/90-gmib-taurus-rndis.yaml')) {
        throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      }
      return readAttribute(file);
    });
    run
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: JSON.stringify(kiosk) });
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      adapters: [{ autoEnabled: true }],
      diagnostic: expect.stringContaining('перезагрузите компьютер'),
    });

    lstat.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
    run
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: JSON.stringify(kiosk) });
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      adapters: [{ autoEnabled: undefined }],
    });
  });

  it('distinguishes an unavailable route inventory from an empty one', async () => {
    mockAdapter(iface.name, 'A0005306');
    run.mockRejectedValueOnce(new Error('ip unavailable')).mockResolvedValueOnce({
      stdout: JSON.stringify(kiosk),
    });
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      routeInspectionComplete: false,
      diagnostic: expect.any(String),
    });
  });

  it('reports an opaque nexthop group as an incomplete inventory', async () => {
    mockAdapter(iface.name, 'A0005306');
    run
      .mockResolvedValueOnce({ stdout: JSON.stringify([{ dst: 'default', nhid: 42 }]) })
      .mockResolvedValueOnce({ stdout: JSON.stringify(kiosk) });
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({
      routeInspectionComplete: false,
    });
  });

  it('skips USB devices without a serial, unrelated USB adapters and interfaces removed mid-read', async () => {
    mockAdapter(iface.name, '');
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({ adapters: [] });
    mockAdapter(iface.name, 'PhoneSerial', 'rndis_host', '0021');
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({ adapters: [] });
    mockAdapter(iface.name, 'A0005306', 'cdc_ether');
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({ adapters: [] });
    realpath.mockRejectedValue(new Error('Removed'));
    await expect(inspectLinuxTaurusRoutes()).resolves.toMatchObject({ adapters: [] });
    expect(run).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === 'win32')(
    'binds the copyable command to the physical serial across a replug and quotes shell syntax',
    async () => {
      const serial = "A000'$(printf injected);#";
      mockAdapter(iface.name, serial);
      const before = await buildLinuxTaurusRouteCommand(`usb:2207:0013:${serial}`);
      mockAdapter('usb0', serial);
      const after = await buildLinuxTaurusRouteCommand(`usb:2207:0013:${serial}`);
      expect(after).toBe(before);

      expect(shellArguments(after)).toEqual([
        '/usr/bin/python3',
        '-I',
        '-c',
        expect.any(String),
        serial,
        '2207',
        '0013',
        '',
      ]);

      readdir.mockResolvedValue([]);
      await expect(buildLinuxTaurusRouteCommand(`usb:2207:0013:${serial}`)).rejects.toThrow(
        /серийному номеру/,
      );
    },
  );

  it.skipIf(process.platform === 'win32')(
    'builds permanent Netplan enable and disable commands with safe physical serial arguments',
    async () => {
      const serial = "A000'$(printf injected);#";
      const deviceId = `usb:2207:0013:${serial}`;
      mockAdapter(iface.name, serial);
      const enable = shellArguments(await buildLinuxTaurusAutomaticCommand(deviceId, true));
      const disable = shellArguments(await buildLinuxTaurusAutomaticCommand(deviceId, false));
      expect(enable[4]).toBe(serial);
      expect(disable[4]).toBe(serial);
      expect(enable[7]).toBe('yes');
      expect(disable[7]).toBe('no');
      expect(disable[8]).toBe('');
      expect(enable[3]).toContain('90-gmib-taurus-rndis.yaml');
      expect(enable[3]).toContain("command('netplan', 'generate', '--root-dir'");
      expect(enable[3]).not.toContain('systemctl');
      expect(enable[8]).toContain("ip('-4', 'route', 'del'");
    },
  );

  it.skipIf(
    process.platform === 'win32' ||
      spawnSync('python3', ['-c', 'import sys; sys.exit(sys.version_info < (3, 10))']).status !== 0,
  )('runs the generated scripts with mock routes, USB devices and Netplan files', async () => {
    const serial = "A000'$(printf injected);#";
    const deviceId = `usb:2207:0013:${serial}`;
    mockAdapter(iface.name, serial);
    const input = JSON.stringify({
      repair: shellArguments(await buildLinuxTaurusRouteCommand(deviceId)),
      enable: shellArguments(await buildLinuxTaurusAutomaticCommand(deviceId, true)),
      disable: shellArguments(await buildLinuxTaurusAutomaticCommand(deviceId, false)),
    });
    const fixture = fileURLToPath(new URL('./linuxTaurusRoutes.fixture.py', import.meta.url));
    const result = spawnSync('python3', ['-I', fixture], { input, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('leaves the system untouched when direct repair has no root privileges', async () => {
    const getuid = process.getuid && vi.spyOn(process, 'getuid').mockReturnValue(1000);
    try {
      await expect(repairLinuxTaurusRoutes('usb:2207:0013:A0005306')).rejects.toThrow(/root/);
      expect(run).not.toHaveBeenCalled();
    } finally {
      getuid?.mockRestore();
    }
  });
});
