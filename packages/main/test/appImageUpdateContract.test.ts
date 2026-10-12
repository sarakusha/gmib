import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

// Execute the installed dependency, rather than duplicating its argument handling in a mock.
const require = createRequire(import.meta.url);
const { BaseUpdater } =
  require('electron-updater/out/BaseUpdater') as typeof import('electron-updater/out/BaseUpdater');
const { AppImageUpdater } =
  require('electron-updater/out/AppImageUpdater') as typeof import('electron-updater/out/AppImageUpdater');
let directory: string | undefined;

afterEach(() => {
  vi.unstubAllEnvs();
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

it('silent install is required to suppress AppImage launch even with autoRunAppAfterInstall enabled', () => {
  const install = vi.fn(() => false);
  const updater = {
    autoRunAppAfterInstall: true,
    install,
    _logger: { info: vi.fn() },
  } as unknown as InstanceType<typeof BaseUpdater>;

  BaseUpdater.prototype.quitAndInstall.call(updater, false, false);
  expect(install).toHaveBeenLastCalledWith(false, true);
  BaseUpdater.prototype.quitAndInstall.call(updater, true, false);
  expect(install).toHaveBeenLastCalledWith(true, false);
});

it.skipIf(process.platform === 'win32')(
  'replaces the stable AppImage and runs only its exit-after-install hook',
  () => {
    directory = mkdtempSync(join(tmpdir(), 'gmib-update-contract-'));
    const appImage = join(directory, 'gmib.AppImage');
    const installer = join(directory, 'gmib-9.9.9.AppImage');
    const result = join(directory, 'install-result');
    writeFileSync(appImage, 'old AppImage');
    // Stand-in AppRun: record the environment that decides whether Electron will start.
    const replacement =
      '#!/bin/sh\nprintf "%s,%s,%s" "$APPIMAGE_SILENT_INSTALL" "$APPIMAGE_EXIT_AFTER_INSTALL" "$#" > "$GMIB_TEST_INSTALL_RESULT"\n';
    writeFileSync(installer, replacement, { mode: 0o755 });
    vi.stubEnv('APPIMAGE', appImage);
    vi.stubEnv('GMIB_TEST_INSTALL_RESULT', result);
    const spawnLog = vi.fn();
    const updater = {
      installerPath: installer,
      spawnLog,
      emit: vi.fn(),
    } as unknown as InstanceType<typeof AppImageUpdater>;

    // doInstall is protected; call the real method without constructing an Electron app.
    const install = AppImageUpdater.prototype as unknown as {
      doInstall: (options: { isSilent: boolean; isForceRunAfter: boolean }) => boolean;
    };
    expect(install.doInstall.call(updater, { isSilent: true, isForceRunAfter: false })).toBe(true);
    expect(readFileSync(appImage, 'utf8')).toBe(replacement);
    expect(readFileSync(result, 'utf8')).toBe('true,true,0');
    expect(spawnLog).not.toHaveBeenCalled();
  },
);
