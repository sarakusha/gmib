import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { scheduleAppImageRelaunch } from '../src/appImageRelaunch';

it.skipIf(process.platform === 'win32')(
  'waits for the old parent and preserves literal arguments/session environment',
  async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'gmib-relaunch-'));
    const logFile = path.join(directory, 'restart.log');
    const parent = spawn(process.execPath, ['-e', 'process.stdin.resume()'], {
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    await once(parent, 'spawn');
    try {
      await scheduleAppImageRelaunch({
        parentPid: parent.pid!,
        execPath: '/bin/sh',
        args: [
          '-c',
          'printf "%s|%s|%s|%s" "$1" "$DISPLAY" "${APPIMAGE_EXIT_AFTER_INSTALL-unset}" "$PWD"',
          'fixture',
          "--name=space ' $(literal)",
        ],
        logFile,
        environment: { ...process.env, DISPLAY: ':fixture', APPIMAGE_EXIT_AFTER_INSTALL: 'true' },
      });
      expect(readFileSync(logFile, 'utf8')).toBe('');
      const exited = once(parent, 'exit');
      parent.stdin!.end();
      await exited;
      await expect
        .poll(() => readFileSync(logFile, 'utf8'), { timeout: 4000 })
        .toBe("--name=space ' $(literal)|:fixture|unset|/");
    } finally {
      parent.kill();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

it('fails before shutdown when the restart log cannot be opened', () => {
  expect(() =>
    scheduleAppImageRelaunch({
      execPath: '/bin/true',
      args: [],
      logFile: '/missing-gmib-directory/restart.log',
    }),
  ).toThrow();
});
