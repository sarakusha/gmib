import { describe, expect, it } from 'vitest';

import { createLicensePresentation } from '../src/licensePresentation';

// cspell:ignore Lqikn JEXW Dejli Vgvtzts

describe('license presentation', () => {
  it('derives local presentation from verified capabilities', () => {
    const result = createLicensePresentation(
      {
        status: 'active',
        plan: 'standard',
        expiresAt: '2026-10-01T00:00:00.000Z',
        capabilities: ['overheat', 'novastar'],
      },
      'a'.repeat(64),
    );

    expect(result).toMatchObject({
      plan: 'standard',
      renew: '2026-10-01T00:00:00.000Z',
      useProxy: true,
    });
    expect(result.message).toContain('kTVgvtztsObADJyScNLdK');
    expect(result.message).toContain('yu6ODejliBoLEEgGBmOEe');
    expect(result.message).not.toContain('YqATOnK8rERXOjt0JEXW0');
  });

  it('does not expose presentation fields for an inactive license', () => {
    expect(
      createLicensePresentation(
        { status: 'expired', plan: 'plus', capabilities: ['novastar', 'plugins', 'taurus'] },
        'a'.repeat(64),
      ),
    ).toEqual({ useProxy: false });
  });
});
