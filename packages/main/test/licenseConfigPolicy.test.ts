import { describe, expect, it } from 'vitest';

import { type Config, DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';

import { getEffectiveLicenseConfig, preserveLicensedConfig } from '../src/licenseConfigPolicy';

const savedConfig = (): Config => ({
  brightness: 42,
  autobrightness: true,
  overheatProtection: { ...DEFAULT_OVERHEAD_PROTECTION, enabled: true },
  logLevel: 'warn',
  location: { latitude: 57, longitude: 65 },
  spline: [
    [0, 10],
    [100, 100],
  ],
  nightMode: { start: '23:00', end: '07:00', brightness: 5 },
});

describe('inactive license configuration', () => {
  it('disables paid execution but preserves saved values across base config round-trips', () => {
    const stored = savedConfig();
    const effective = getEffectiveLicenseConfig(stored, false);
    expect(effective.autobrightness).toBe(false);
    expect(effective.overheatProtection.enabled).toBe(false);
    expect(stored.autobrightness).toBe(true);
    expect(stored.overheatProtection.enabled).toBe(true);

    const updated = preserveLicensedConfig(stored, { ...effective, brightness: 70 }, false);
    expect(updated).toEqual({ ...stored, brightness: 70 });
    expect(getEffectiveLicenseConfig(updated, false).autobrightness).toBe(false);
    expect(getEffectiveLicenseConfig(updated, true).autobrightness).toBe(true);
    expect(getEffectiveLicenseConfig(updated, true).overheatProtection.enabled).toBe(true);
  });

  it('accepts base server updates retaining the stored premium values', () => {
    const stored = savedConfig();
    expect(preserveLicensedConfig(stored, { ...stored, brightness: 60 }, false)).toEqual({
      ...stored,
      brightness: 60,
    });
  });

  it.each<Partial<Config>>([
    { autobrightness: true },
    { overheatProtection: { ...DEFAULT_OVERHEAD_PROTECTION, enabled: true } },
    { location: { latitude: 1, longitude: 2 } },
    {
      spline: [
        [0, 1],
        [1, 100],
      ],
    },
    { sunSpline: [['time:12:00', 50]] },
    { nightMode: { start: '22:00', end: '08:00', brightness: 10 } },
  ])('rejects changed paid settings without changing storage: %j', patch => {
    const stored = savedConfig();
    stored.autobrightness = false;
    stored.overheatProtection.enabled = false;
    const before = structuredClone(stored);
    expect(() => preserveLicensedConfig(stored, { ...stored, ...patch }, false)).toThrow(
      'Требуется действующая лицензия',
    );
    expect(stored).toEqual(before);
    expect(preserveLicensedConfig(stored, { ...stored, ...patch }, true)).toEqual({
      ...stored,
      ...patch,
    });
  });
});
