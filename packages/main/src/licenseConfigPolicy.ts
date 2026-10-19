import { isDeepStrictEqual } from 'node:util';

import { type Config, DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import type { GmibSchedulerAction } from '/@common/scheduler';

const licensedConfigKeys = [
  'autobrightness',
  'overheatProtection',
  'location',
  'spline',
  'sunSpline',
  'nightMode',
] as const satisfies readonly (keyof Config)[];

export const licenseConfigDenied = (): Error & { status: number } =>
  Object.assign(new Error('Требуется действующая лицензия'), { status: 403 });

// Disable execution without destroying the saved settings needed after renewal.
export const getEffectiveLicenseConfig = (stored: Config, active: boolean): Config =>
  active
    ? stored
    : {
        ...stored,
        autobrightness: false,
        overheatProtection: {
          ...(stored.overheatProtection ?? DEFAULT_OVERHEAD_PROTECTION),
          enabled: false,
        },
      };

export const preserveLicensedConfig = (
  stored: Config,
  proposed: Config,
  active: boolean,
): Config => {
  if (active) return proposed;
  const effective = getEffectiveLicenseConfig(stored, false);
  const next = { ...proposed };
  for (const key of licensedConfigKeys) {
    // NiBUS clients round-trip the effective full config, while server-side
    // updates may retain the stored values. Neither may erase paid settings.
    if (
      !isDeepStrictEqual(proposed[key], stored[key]) &&
      !isDeepStrictEqual(proposed[key], effective[key])
    ) {
      throw licenseConfigDenied();
    }
    if (Object.hasOwn(stored, key)) Object.assign(next, { [key]: stored[key] });
    else delete next[key];
  }
  return next;
};

export const canRunLicensedGmibAction = (action: GmibSchedulerAction, active: boolean): boolean =>
  active || (action !== 'set-autobrightness' && action !== 'set-overheat-protection');
