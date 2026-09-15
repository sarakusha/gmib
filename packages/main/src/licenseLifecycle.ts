import type { LicensePayloadV2, LicenseRuntimeState } from '/@common/license';

export const shouldRefreshStoredLicense = (state: LicenseRuntimeState): boolean =>
  state.status !== 'active' && state.status !== 'invalid';

export const sessionTermsChanged = (
  current: LicensePayloadV2,
  refreshed: LicensePayloadV2,
): boolean =>
  current.status !== refreshed.status ||
  current.plan !== refreshed.plan ||
  current.expiresAt !== refreshed.expiresAt ||
  [...current.capabilities].sort().join('\0') !== [...refreshed.capabilities].sort().join('\0');
