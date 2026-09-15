import type { LicenseRuntimeState } from '/@common/license';

export function getRuntimeAccessError(
  license: LicenseRuntimeState,
  remoteSession = false,
): string | undefined {
  if (remoteSession || license.status === 'active') return undefined;
  return license.message || 'Требуется действующая лицензия';
}
