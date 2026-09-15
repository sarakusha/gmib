import type { LicenseRuntimeStatus } from '/@common/license';

const retryableStatuses = new Set<LicenseRuntimeStatus>([
  'migration-required',
  'expired',
  'disabled',
  'unlicensed',
]);

export const canRetryStoredLicense = (status?: LicenseRuntimeStatus): boolean =>
  status !== undefined && retryableStatuses.has(status);
