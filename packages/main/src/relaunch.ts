import { app, type RelaunchOptions } from 'electron';

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
          preserveOzonePlatform ||
          (arg !== '--ozone-platform' && !arg.startsWith('--ozone-platform=')),
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
    scheduled = true;
    schedule(options);
    return true;
  };
};

const scheduleRelaunch = createRelaunchScheduler();

let restart = false;

export const needRestart = (val?: true) => {
  if (val) restart = val;
  return restart;
};

export default () => {
  if (import.meta.env.PROD) {
    needRestart(true);
    if (!isRelaunchManagedBySupervisor()) {
      // app.relaunch waits for this instance to exit before starting the next one. This is
      // important for AppImage too: spawning it directly races the single-instance lock.
      scheduleRelaunch(buildRelaunchOptions());
    }
  }
  // A supervised kiosk is restarted by gmib-cage@.service (Restart=always), which also
  // restores Cage and the exact kiosk command line without starting a competing instance.
  app.quit();
};
