import type { NetworkInterfaceInfo } from 'node:os';

import { describe, expect, it } from 'vitest';

import { selectWindowsMdnsInterfaces } from '../src/bonjourInterface';

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

describe('Windows mDNS interface selection', () => {
  it('selects the active LAN address', () => {
    expect(
      selectWindowsMdnsInterfaces({
        WiFi: [ipv4('192.168.0.48')],
        Loopback: [ipv4('127.0.0.1', '255.0.0.0', true)],
      }),
    ).toEqual(['192.168.0.48']);
  });

  it('selects every active IPv4 interface', () => {
    expect(
      selectWindowsMdnsInterfaces({
        VPN: [ipv4('10.8.1.3', '255.255.255.255')],
        Ethernet: [ipv4('169.254.4.2', '255.255.0.0')],
        WiFi: [ipv4('192.168.0.140')],
      }),
    ).toEqual(['10.8.1.3', '169.254.4.2', '192.168.0.140']);
  });

  it('returns undefined without an external IPv4 address', () => {
    expect(
      selectWindowsMdnsInterfaces({
        Loopback: [ipv4('127.0.0.1', '255.0.0.0', true)],
      }),
    ).toEqual([]);
  });
});
