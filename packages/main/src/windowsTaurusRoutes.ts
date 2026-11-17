import { execFile } from 'node:child_process';
import path from 'node:path';

import type { WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';
import script from './windowsTaurusRoutes.ps1?raw';

const [eventScript] = script.split(/\r?\n#region Task Scheduler configuration\r?\n/, 1);

export const validateTaurusUsbId = (id: unknown): string => {
  if (typeof id !== 'string' || !/^USB\\VID_2207&PID_0013\\[A-Z0-9_-]{4,64}$/i.test(id)) {
    throw new Error('Некорректный идентификатор USB Taurus');
  }
  return id.toUpperCase();
};

export const buildTaurusRouteCommand = (id: unknown): string =>
  `${script}\nRepair-GmibTaurusRoute '${validateTaurusUsbId(id)}'\nGet-GmibTaurusStatus | ConvertTo-Json -Depth 6\n`;

export const buildTaurusAutomaticCommand = (id: unknown, enabled: boolean): string => {
  const deviceId = validateTaurusUsbId(id);
  if (typeof enabled !== 'boolean')
    throw new Error('Некорректный режим автоматического исправления');
  // The task contains the fixed command itself: SYSTEM never executes a user-writable file.
  const action = enabled
    ? Buffer.from(`${eventScript}\nInvoke-GmibTaurusEventRepair '${deviceId}'`, 'utf16le').toString(
        'base64',
      )
    : '';
  return `${script}\nSet-GmibTaurusAutomatic '${deviceId}' $${enabled} '${action}'\nGet-GmibTaurusStatus | ConvertTo-Json -Depth 6\n`;
};

export const runTaurusPowerShell = async (command: string): Promise<string> => {
  const executable = path.win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  return new Promise((resolve, reject) => {
    // Stream large setup scripts rather than exceeding Windows' command-line length limit.
    const bootstrap =
      '[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); & ([scriptblock]::Create([Console]::In.ReadToEnd()))';
    const child = execFile(
      executable,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(bootstrap, 'utf16le').toString('base64'),
      ],
      { timeout: 25_000, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error)
          reject(
            new Error(
              stderr.trim().slice(0, 1800) ||
                'Не удалось выполнить проверку сети: PowerShell недоступен или превышено время ожидания.',
            ),
          );
        else resolve(stdout);
      },
    );
    child.stdin?.on('error', () => undefined); // execFile's callback reports spawn/exit errors.
    child.stdin?.end(command, 'utf8');
  });
};

// Dependency injection lets tests exercise the same command used by both IPC and clipboard.
export const createWindowsTaurusRoutes = (run = runTaurusPowerShell) => ({
  inspect: async (): Promise<WindowsTaurusRouteStatus> =>
    JSON.parse(
      await run(`${script}\nGet-GmibTaurusStatus | ConvertTo-Json -Depth 6`),
    ) as WindowsTaurusRouteStatus,
  repair: async (id: unknown): Promise<void> => {
    await run(buildTaurusRouteCommand(id));
  },
  commands: buildTaurusRouteCommand,
  setAutomatic: async (id: unknown, enabled: boolean): Promise<void> => {
    await run(buildTaurusAutomaticCommand(id, enabled));
  },
  automaticCommands: buildTaurusAutomaticCommand,
});
