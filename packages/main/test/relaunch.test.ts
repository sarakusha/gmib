import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    relaunch: vi.fn(),
  },
}));

vi.mock('../src/localConfig', () => ({
  default: {
    get: vi.fn(() => false),
  },
}));

import {
  buildRelaunchOptions,
  createRelaunchScheduler,
  isRelaunchManagedBySupervisor,
  resolveRelaunchExecPath,
} from '../src/relaunch';

describe('relaunch', () => {
  it('uses the AppImage path while preserving the kiosk launch arguments', () => {
    expect(
      buildRelaunchOptions(
        ['--no-sandbox', '--kiosk-mode', '--ozone-platform=wayland'],
        false,
        '/opt/gmib/gmib.AppImage',
      ),
    ).toEqual({
      args: ['--no-sandbox', '--kiosk-mode', '--ozone-platform=wayland', '--relaunch'],
      execPath: '/opt/gmib/gmib.AppImage',
    });
  });

  it('relaunches a packaged AppImage through its stable mount-independent path', () => {
    expect(resolveRelaunchExecPath('/tmp/.mount_gmib/gmib', true, '/opt/gmib/gmib.AppImage')).toBe(
      '/opt/gmib/gmib.AppImage',
    );
    expect(resolveRelaunchExecPath('/usr/bin/electron', false, '/opt/gmib/gmib.AppImage')).toBe(
      '/usr/bin/electron',
    );
  });

  it('delegates a systemd kiosk restart to its Restart=always service', () => {
    expect(
      isRelaunchManagedBySupervisor(['/opt/gmib/gmib.AppImage', '--kiosk-mode'], {
        INVOCATION_ID: 'systemd-invocation',
      }),
    ).toBe(true);
    expect(
      isRelaunchManagedBySupervisor(['/opt/gmib/gmib.AppImage'], {
        INVOCATION_ID: 'systemd-invocation',
      }),
    ).toBe(false);
    expect(isRelaunchManagedBySupervisor(['/opt/gmib/gmib.AppImage', '--kiosk-mode'], {})).toBe(
      false,
    );
  });

  it('schedules only one replacement instance', () => {
    const schedule = vi.fn();
    const scheduleRelaunch = createRelaunchScheduler(schedule);
    const options = buildRelaunchOptions([], false, '/opt/gmib/gmib.AppImage');

    expect(scheduleRelaunch(options)).toBe(true);
    expect(scheduleRelaunch(options)).toBe(false);
    expect(schedule).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith(options);
  });
});
