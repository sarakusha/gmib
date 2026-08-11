import { describe, expect, it } from 'vitest';

import {
  getGmibServiceHostname,
  getGmibServiceName,
  getNovastarServiceName,
} from '../src/serviceIdentity';

describe('GMIB service identity', () => {
  it('creates a stable unique DNS hostname from the GMIB identifier', () => {
    expect(getGmibServiceHostname('device_1234')).toBe('gmib-device1234.local');
    expect(getGmibServiceHostname('second-device')).not.toBe(getGmibServiceHostname('device_1234'));
  });

  it('creates a DNS-safe unique service instance name', () => {
    expect(getGmibServiceName('device_1234')).toBe('gmib-device1234');
    expect(getNovastarServiceName('device_1234')).toBe('novastar-device1234');
  });
});
