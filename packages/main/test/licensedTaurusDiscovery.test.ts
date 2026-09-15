import { describe, expect, it, vi } from 'vitest';

import { discoverLicensedTaurus } from '../src/licensedTaurusDiscovery';

describe('discoverLicensedTaurus', () => {
  it('does not call the Taurus transport without runtime access', async () => {
    const discover = vi.fn();

    await expect(discoverLicensedTaurus(false, undefined, discover)).resolves.toEqual([]);
    expect(discover).not.toHaveBeenCalled();
  });

  it('runs discovery with runtime access', async () => {
    const player = { address: '192.0.2.1', sn: 'test' };
    const discover = vi.fn().mockResolvedValue([player]);

    await expect(discoverLicensedTaurus(true, '192.0.2.255', discover)).resolves.toEqual([player]);
    expect(discover).toHaveBeenCalledWith('192.0.2.255');
  });
});
