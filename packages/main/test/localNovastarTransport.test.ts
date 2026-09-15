import { describe, expect, it } from 'vitest';

import { hasLocalNovastarTransport, isIPv4LinkLocal } from '../src/localNovastarTransport';

describe('local NovaStar transport', () => {
  it('recognizes IPv4 link-local addresses', () => {
    expect(isIPv4LinkLocal('169.254.42.7')).toBe(true);
    expect(isIPv4LinkLocal('192.168.0.121')).toBe(false);
  });

  it('recognizes a Linux RNDIS interface before it receives an IPv4 address', () => {
    const interfaces = {
      enx123: [
        {
          address: 'fe80::1',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6' as const,
          mac: '00:11:22:33:44:55',
          internal: false,
          cidr: 'fe80::1/64',
          scopeid: 5,
        },
      ],
    };

    expect(hasLocalNovastarTransport(interfaces, () => '/drivers/rndis_host', 'linux')).toBe(true);
    expect(hasLocalNovastarTransport(interfaces, () => '/drivers/rndis_host', 'darwin')).toBe(
      false,
    );
  });
});
