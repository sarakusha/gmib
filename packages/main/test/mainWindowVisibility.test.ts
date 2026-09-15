import { describe, expect, it } from 'vitest';

import { shouldShowLocalWindow } from '../src/mainWindowVisibility';

describe('shouldShowLocalWindow', () => {
  it.each([
    'checking',
    'migration-required',
    'expired',
    'disabled',
    'invalid',
    'unlicensed',
  ] as const)('shows the recovery interface for %s state in kiosk autostart', licenseStatus => {
    expect(
      shouldShowLocalWindow({ licenseStatus, kiosk: true, autostart: true, hidden: true }),
    ).toBe(true);
  });

  it('keeps an active kiosk window hidden', () => {
    expect(
      shouldShowLocalWindow({
        licenseStatus: 'active',
        kiosk: true,
        autostart: false,
        hidden: false,
      }),
    ).toBe(false);
  });

  it('respects the saved startup visibility for an active desktop runtime', () => {
    expect(
      shouldShowLocalWindow({
        licenseStatus: 'active',
        kiosk: false,
        autostart: false,
        hidden: false,
      }),
    ).toBe(true);
    expect(
      shouldShowLocalWindow({
        licenseStatus: 'active',
        kiosk: false,
        autostart: true,
        hidden: false,
      }),
    ).toBe(false);
  });
});
