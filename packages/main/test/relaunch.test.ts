import { describe, expect, it, vi } from 'vitest';

const restartMocks = vi.hoisted(() => ({ schedule: vi.fn(), quit: vi.fn() }));
vi.mock('../src/appImageRelaunch', () => ({ scheduleAppImageRelaunch: restartMocks.schedule }));

vi.mock('electron-log', () => ({ default: { error: vi.fn() } }));

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    quit: restartMocks.quit,
    getPath: () => '/tmp',
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
  it('does not replay a consumed external link after restart', () => {
    expect(
      buildRelaunchOptions(
        ['gmib://host:1234', '--relaunch', '--relaunch', '--kiosk-mode'],
        false,
        '/opt/gmib',
      ).args,
    ).toEqual(['--kiosk-mode', '--relaunch']);
  });
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
        GMIB_KIOSK_MODE: '1',
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

it('waits for helper readiness, schedules once, and keeps the app open on startup failure', async () => {
  const platform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  vi.stubEnv('PROD', true);
  vi.stubEnv('APPIMAGE', '/opt/gmib/gmib.AppImage');
  vi.stubEnv('INVOCATION_ID', '');
  try {
    vi.resetModules();
    restartMocks.quit.mockClear();
    restartMocks.schedule.mockReset();
    const { restartWithOptions } = await import('../src/relaunch');
    restartMocks.schedule.mockRejectedValueOnce(new Error('cannot open log'));
    await expect(
      restartWithOptions({ execPath: '/opt/gmib/gmib.AppImage', args: [] }),
    ).rejects.toThrow('cannot open log');
    expect(restartMocks.quit).not.toHaveBeenCalled();
    let ready!: () => void;
    restartMocks.schedule.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          ready = resolve;
        }),
    );
    const pending = restartWithOptions({
      execPath: '/opt/gmib/gmib.AppImage',
      args: ['--no-sandbox'],
    });
    await restartWithOptions();
    expect(restartMocks.schedule).toHaveBeenCalledTimes(2);
    expect(restartMocks.quit).not.toHaveBeenCalled();
    ready();
    await pending;
    expect(restartMocks.quit).toHaveBeenCalledOnce();
  } finally {
    Object.defineProperty(process, 'platform', { value: platform });
    vi.unstubAllEnvs();
  }
});
