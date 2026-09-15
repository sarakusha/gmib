import type { LicenseRuntimeState } from '/@common/license';

export function getRuntimeAccessError(license: LicenseRuntimeState): string | undefined {
  if (license.status === 'active') return undefined;
  return license.message || 'Требуется действующая лицензия';
}
