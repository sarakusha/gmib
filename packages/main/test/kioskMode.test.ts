import { describe, expect, it } from 'vitest';

import { isKioskMode } from '../src/kioskMode';

describe('kiosk mode', () => {
  it('is enabled by the command-line switch', () => {
    expect(isKioskMode(['/opt/gmib/gmib', '--kiosk-mode'], {})).toBe(true);
  });

  it('is enabled by the systemd-friendly environment variable', () => {
    expect(isKioskMode(['/opt/gmib/gmib'], { GMIB_KIOSK_MODE: '1' })).toBe(true);
    expect(isKioskMode(['/opt/gmib/gmib'], { GMIB_KIOSK_MODE: 'true' })).toBe(true);
  });

  it('is disabled by default', () => {
    expect(isKioskMode(['/opt/gmib/gmib'], {})).toBe(false);
  });
});
