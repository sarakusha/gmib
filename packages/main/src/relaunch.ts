import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { app, dialog, type RelaunchOptions } from 'electron';
import log from 'electron-log';

import { scheduleAppImageRelaunch } from './appImageRelaunch';

import localConfig from './localConfig';
import { isKioskMode } from './kioskMode';

export const isRelaunchManagedBySupervisor = (
  args: readonly string[] = process.argv,
  environment: NodeJS.ProcessEnv = process.env,
): boolean => Boolean(environment.INVOCATION_ID) && isKioskMode(args, environment);

export const resolveRelaunchExecPath = (
  execPath = process.execPath,
  isPackaged = app.isPackaged,
  appImage = process.env.APPIMAGE,
): string => (isPackaged && appImage ? appImage : execPath);

export const buildRelaunchOptions = (
  args: readonly string[] = process.argv.slice(1),
  exactWindowPlacement = localConfig.get('exactWindowPlacement'),
  execPath = resolveRelaunchExecPath(),
): RelaunchOptions => {
  const preserveOzonePlatform = exactWindowPlacement || args.includes('--kiosk-mode');
  return {
    args: [
      ...args.filter(
        arg =>
          !/^gmib:/i.test(arg) &&
          arg !== '--relaunch' &&
          (preserveOzonePlatform ||
            (arg !== '--ozone-platform' && !arg.startsWith('--ozone-platform='))),
      ),
      '--relaunch',
    ],
    execPath,
  };
};

export const createRelaunchScheduler = (
  schedule: (options: RelaunchOptions) => void = options => app.relaunch(options),
) => {
  let scheduled = false;

  return (options: RelaunchOptions): boolean => {
    if (scheduled) return false;
    schedule(options);
    scheduled = true;
    return true;
  };
};

const scheduleRelaunch = createRelaunchScheduler();

export const isLinuxAppImage = () =>
  process.platform === 'linux' && app.isPackaged && Boolean(process.env.APPIMAGE);

let restart = false;

export const needRestart = (val?: boolean) => {
  if (val !== undefined) restart = val;
  return restart;
};

let restartPending = false;

export const restartWithOptions = async (options = buildRelaunchOptions()): Promise<void> => {
  if (restartPending) return;
  restartPending = true;
  try {
    if (import.meta.env.PROD && !isRelaunchManagedBySupervisor()) {
      if (isLinuxAppImage()) {
        const logDirectory = app.getPath('logs');
        mkdirSync(logDirectory, { recursive: true });
        await scheduleAppImageRelaunch({
          execPath: options.execPath ?? resolveRelaunchExecPath(),
          args: options.args ?? [],
          logFile: path.join(logDirectory, 'gmib-relaunch.log'),
        });
      } else {
        scheduleRelaunch(options);
      }
    }
    needRestart(true);
    // Supervised kiosks use Restart=always; other AppImages have a ready waiter.
    app.quit();
  } catch (error) {
    restartPending = false;
    needRestart(false);
    throw error;
  }
};

export default () => {
  void restartWithOptions().catch(error => {
    log.error('Failed to restart GMIB; application remains open', error);
    void dialog
      .showMessageBox({
        type: 'error',
        title: 'Ошибка перезапуска',
        message:
          'Не удалось подготовить перезапуск. Приложение остаётся открытым; повторите перезапуск или запустите GMIB вручную.',
        detail: error instanceof Error ? error.message : String(error),
      })
      .catch(dialogError => log.error('Failed to show restart error', dialogError));
  });
};
