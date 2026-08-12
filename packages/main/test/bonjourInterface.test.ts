import type { NetworkInterfaceInfo } from 'node:os';

import { describe, expect, it } from 'vitest';

import { selectBonjourAddressRecords, selectMdnsInterfaces } from '../src/bonjourInterface';

const ipv4 = (
  address: string,
  netmask = '255.255.255.0',
  internal = false,
): NetworkInterfaceInfo => ({
  address,
  netmask,
  family: 'IPv4',
  mac: '00:00:00:00:00:00',
  internal,
  cidr: `${address}/24`,
});

describe('mDNS interface selection', () => {
  it('selects the active LAN address', () => {
    expect(
      selectMdnsInterfaces({
        WiFi: [ipv4('192.168.0.48')],
        Loopback: [ipv4('127.0.0.1', '255.0.0.0', true)],
      }),
    ).toEqual(['192.168.0.48']);
  });

  it('selects every active IPv4 interface', () => {
    expect(
      selectMdnsInterfaces({
        VPN: [ipv4('10.8.1.3', '255.255.255.255')],
        Ethernet: [ipv4('169.254.4.2', '255.255.0.0')],
        WiFi: [ipv4('192.168.0.140')],
      }),
    ).toEqual(['10.8.1.3', '169.254.4.2', '192.168.0.140']);
  });

  it('returns undefined without an external IPv4 address', () => {
    expect(
      selectMdnsInterfaces({
        Loopback: [ipv4('127.0.0.1', '255.0.0.0', true)],
      }),
    ).toEqual([]);
  });

  it('publishes only the IPv4 address belonging to the responder', () => {
    const ptr = { type: 'PTR', data: 'gmib._nibus._tcp.local' };
    const selected = selectBonjourAddressRecords(
      [
        ptr,
        { type: 'A', data: '192.168.0.48' },
        { type: 'A', data: '10.8.0.2' },
        { type: 'AAAA', data: 'fe80::1' },
      ],
      '192.168.0.48',
    );
    expect(selected).toEqual([ptr, { type: 'A', data: '192.168.0.48' }]);
  });
});
