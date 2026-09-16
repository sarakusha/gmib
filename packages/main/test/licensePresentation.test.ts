import { describe, expect, it, vi } from 'vitest';

import type { LicensePayloadV2 } from '/@common/license';
import { applyLicensePresentation, getLicensePresentation } from '../src/licensePresentation';

const payload = (status: LicensePayloadV2['status'] = 'active'): LicensePayloadV2 => ({
  version: 2,
  issuer: 'app.nata-info.ru',
  audience: 'gmib',
  keyId: 'test',
  licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
  deviceId: 'a'.repeat(64),
  issuedAt: '2026-09-15T10:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
  status,
  plan: 'standard',
  capabilities: ['overheat', 'novastar'],
  presentation: { version: 1, css: 'server-signed-css' },
});

describe('license presentation', () => {
  it('uses the presentation already contained in the verified document', () => {
    expect(getLicensePresentation(payload())).toEqual({
      plan: 'standard',
      renew: '2026-10-01T00:00:00.000Z',
      useProxy: true,
      message: 'server-signed-css',
    });
  });

  it('does not expose presentation fields without an active verified payload', () => {
    expect(getLicensePresentation()).toEqual({ useProxy: false });
    expect(getLicensePresentation(payload('expired'))).toEqual({ useProxy: false });
  });
});

describe('license presentation application', () => {
  it('applies a verified session snapshot after its signed expiry', () => {
    const apply = vi.fn();
    expect(
      applyLicensePresentation(
        'signed-css',
        true,
        '2026-09-16T00:00:00.000Z',
        apply,
        '2026-09-16T00:00:01.000Z',
      ),
    ).toBe(true);
    expect(apply).toHaveBeenCalledWith('signed-css');
  });

  it('keeps the legacy expiry gate for an unverified presentation', () => {
    const apply = vi.fn();
    expect(
      applyLicensePresentation(
        'legacy-css',
        false,
        '2026-09-16T00:00:00.000Z',
        apply,
        '2026-09-16T00:00:01.000Z',
      ),
    ).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});
