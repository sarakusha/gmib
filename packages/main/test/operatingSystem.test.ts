import { describe, expect, it, vi } from 'vitest';

import { collectOperatingSystem, parseOsRelease } from '../src/operatingSystem';

describe('OS release metadata', () => {
  it.each([
    ['PRETTY_NAME="Ubuntu 24.04.3 LTS"\nVERSION_ID="24.04"', 'Ubuntu 24.04.3 LTS'],
    ["NAME='Debian GNU/Linux'\nVERSION_ID=12", 'Debian GNU/Linux 12'],
    ['NAME=Ubuntu\nVERSION="24.04.3 LTS (Noble Numbat)"', 'Ubuntu 24.04.3 LTS (Noble Numbat)'],
    ['# PRETTY_NAME="ignored"\nPRETTY_NAME=\nNAME=Linux', 'Linux'],
    ['PRETTY_NAME="First"\nPRETTY_NAME="Second"', 'Second'],
    ['PRETTY_NAME="unterminated\nID=ubuntu', undefined],
    ['PRETTY_NAME="Example \\"quoted\\" \\$release"', 'Example "quoted" $release'],
    ['PRETTY_NAME="$(touch /tmp/must-not-execute)"', '$(touch /tmp/must-not-execute)'],
    ['', undefined],
  ])('reads os-release as data: %s', (source, expected) => {
    expect(parseOsRelease(source)).toBe(expected);
  });

  it('reports the macOS product version rather than the Darwin kernel version', () => {
    const readRelease = vi.fn();
    expect(
      collectOperatingSystem(
        'darwin',
        () => 'Darwin Kernel Version 27.0.0',
        readRelease,
        () => '27.0.1\n',
      ),
    ).toBe('macOS 27.0.1');
    expect(readRelease).not.toHaveBeenCalled();
  });

  it('reports the Linux distribution independently of its kernel package version', () => {
    const readRelease = vi.fn(() => 'PRETTY_NAME="Ubuntu 24.04.3 LTS"');
    expect(collectOperatingSystem('linux', () => '#146-Ubuntu SMP', readRelease)).toBe(
      'Ubuntu 24.04.3 LTS',
    );
    expect(readRelease).toHaveBeenCalledExactlyOnceWith('/etc/os-release');
  });

  it('uses the vendor file only if /etc/os-release is absent', () => {
    const readRelease = vi.fn((path: string) => {
      if (path === '/etc/os-release') throw Object.assign(new Error('absent'), { code: 'ENOENT' });
      return 'NAME=Debian\nVERSION_ID=12';
    });
    expect(collectOperatingSystem('linux', () => 'kernel', readRelease)).toBe('Debian 12');
    expect(readRelease.mock.calls.map(([path]) => path)).toEqual([
      '/etc/os-release',
      '/usr/lib/os-release',
    ]);
  });

  it('does not merge an empty /etc/os-release with the vendor file', () => {
    const readRelease = vi.fn(() => 'ID=linux');
    expect(collectOperatingSystem('linux', () => '#1 SMP', readRelease)).toBe('#1 SMP');
    expect(readRelease).toHaveBeenCalledTimes(1);
  });

  it.each(['darwin', 'linux'] as const)(
    'keeps legacy metadata when %s detection fails',
    platform => {
      const fail = () => {
        throw new Error('unavailable');
      };
      expect(collectOperatingSystem(platform, () => 'legacy kernel', fail, fail)).toBe(
        'legacy kernel',
      );
    },
  );

  it('keeps legacy metadata for invalid macOS output', () => {
    expect(
      collectOperatingSystem(
        'darwin',
        () => 'Darwin',
        vi.fn(),
        () => 'invalid',
      ),
    ).toBe('Darwin');
  });

  it('preserves Windows metadata without invoking Unix detection', () => {
    const read = vi.fn();
    expect(collectOperatingSystem('win32', () => 'Windows 11 Pro', read, read)).toBe(
      'Windows 11 Pro',
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('bounds metadata to the existing license request limit', () => {
    const release = collectOperatingSystem(
      'linux',
      vi.fn(),
      () => `PRETTY_NAME="${'X'.repeat(600)}"`,
    );
    expect(release.length).toBe(500);
  });
});
