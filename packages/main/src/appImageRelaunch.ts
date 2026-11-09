import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';

// Spawned by Node rather than Electron's Chromium relauncher: the latter sets
// sticky NoNewPrivs on its helper, preventing setuid fusermount from mounting.
// All variable data is positional, never interpolated into shell source.
const waiter = `
parent="$1"
shift
printf 'ready\\n'
exec 1>&2
attempt=0
while kill -0 "$parent" 2>/dev/null; do
  if [ "$attempt" -ge 120 ]; then
    printf '%s\\n' 'GMIB restart cancelled: original process did not exit within 120 seconds.' >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done
exec "$@"
`;

export interface AppImageRelaunchOptions {
  execPath: string;
  args: readonly string[];
  logFile: string;
  parentPid?: number;
  environment?: NodeJS.ProcessEnv;
}

/** Resolves only once the independent waiter is ready; callers may then quit. */
export const scheduleAppImageRelaunch = ({
  execPath,
  args,
  logFile,
  parentPid = process.pid,
  environment = process.env,
}: AppImageRelaunchOptions): Promise<void> => {
  const env = { ...environment };
  for (const key of [
    'APPIMAGE',
    'APPDIR',
    'ARGV0',
    'APPIMAGE_EXIT_AFTER_INSTALL',
    'APPIMAGE_SILENT_INSTALL',
  ])
    delete env[key];
  const logFd = openSync(logFile, 'a', 0o600);
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(
      '/bin/sh',
      ['-c', waiter, 'gmib-relaunch', String(parentPid), execPath, ...args],
      {
        detached: true,
        stdio: ['ignore', 'pipe', logFd],
        env,
        // Never inherit a cwd inside the old AppImage mount.
        cwd: '/',
      },
    );
  } finally {
    closeSync(logFd);
  }
  return new Promise<void>((resolve, reject) => {
    let ready = false;
    let output = '';
    const failed = (error: Error) => {
      if (ready) return;
      ready = true;
      clearTimeout(timer);
      child.stdout?.destroy();
      child.kill();
      reject(error);
    };
    const timer = setTimeout(
      () => failed(new Error('AppImage restart helper did not become ready')),
      5000,
    );
    child.once('error', failed);
    child.once('exit', (code, signal) => {
      failed(new Error(`AppImage restart helper exited before readiness (${code ?? signal})`));
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (!ready && output.includes('ready\n')) {
        ready = true;
        clearTimeout(timer);
        child.stdout?.destroy();
        child.unref();
        resolve();
      }
    });
  });
};
