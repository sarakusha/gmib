import { describe, expect, it } from 'vitest';

import { createWindowsMdnsFirewallCommands } from '../src/windowsFirewall';

describe('Windows mDNS firewall commands', () => {
  it('scopes rules to GMIB and makes repeated execution idempotent', () => {
    const commands = createWindowsMdnsFirewallCommands("C:\\Program Files\\GMIB's\\gmib.exe");

    expect(commands).toContain("$gmibPath = 'C:\\Program Files\\GMIB''s\\gmib.exe'");
    expect(commands).toContain("Get-NetFirewallRule -DisplayName 'GMIB mDNS UDP In'");
    expect(commands).toContain('-Program $gmibPath');
    expect(commands).toContain('-LocalPort 5353 -RemoteAddress LocalSubnet');
    expect(commands).toContain('-RemotePort 5353 -RemoteAddress 224.0.0.251');
  });
});
