import { describe, expect, it } from 'vitest';

import { hasExplicitOzonePlatform, shouldUseX11 } from '../src/linuxDisplayServer';

describe('Linux display server selection', () => {
  it('uses XWayland when both Wayland and X11 are available', () => {
    expect(shouldUseX11(true, 'linux', { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' })).toBe(
      true,
    );
  });

  it('keeps native Wayland when XWayland is unavailable', () => {
    expect(shouldUseX11(true, 'linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(false);
  });

  it('does not affect other operating systems', () => {
    expect(shouldUseX11(true, 'darwin', { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' })).toBe(
      false,
    );
  });

  it('keeps Wayland unless exact positioning is enabled', () => {
    expect(shouldUseX11(false, 'linux', { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' })).toBe(
      false,
    );
  });

  it('distinguishes a user-provided Ozone switch from Electron internal state', () => {
    expect(hasExplicitOzonePlatform(['/opt/gmib/gmib', '--no-sandbox'])).toBe(false);
    expect(hasExplicitOzonePlatform(['/opt/gmib/gmib', '--ozone-platform=x11'])).toBe(true);
    expect(hasExplicitOzonePlatform(['/opt/gmib/gmib', '--ozone-platform', 'wayland'])).toBe(true);
  });
});
