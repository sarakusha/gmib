import type { LicenseRuntimeStatus } from '/@common/license';

type LocalWindowVisibility = {
  licenseStatus: LicenseRuntimeStatus;
  kiosk: boolean;
  autostart: boolean;
  hidden: boolean;
};

export const shouldShowLocalWindow = ({
  licenseStatus,
  kiosk,
  autostart,
  hidden,
}: LocalWindowVisibility): boolean =>
  licenseStatus !== 'active' || (!kiosk && !autostart && !hidden);
