import type { LicensePayloadV2, LicenseRuntimeState } from '/@common/license';

export const getPayloadRuntimeState = (
  payload: LicensePayloadV2,
  now = Date.now(),
): LicenseRuntimeState => {
  const locallyExpired = payload.expiresAt !== null && now >= Date.parse(payload.expiresAt);
  const payloadStatus = locallyExpired && payload.status === 'active' ? 'expired' : payload.status;
  return {
    status: payloadStatus === 'unbound' ? 'unlicensed' : payloadStatus,
    plan: payload.plan,
    expiresAt: payload.expiresAt,
    capabilities: payload.capabilities,
  };
};

export const shouldRefreshStoredLicense = (state: LicenseRuntimeState): boolean =>
  state.status !== 'active' && state.status !== 'invalid';

export const sessionTermsChanged = (
  current: LicensePayloadV2,
  refreshed: LicensePayloadV2,
): boolean =>
  current.status !== refreshed.status ||
  current.plan !== refreshed.plan ||
  current.expiresAt !== refreshed.expiresAt ||
  [...current.capabilities].sort().join('\0') !== [...refreshed.capabilities].sort().join('\0') ||
  current.presentation.version !== refreshed.presentation.version ||
  current.presentation.css !== refreshed.presentation.css;
