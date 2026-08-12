import { execFile } from 'child_process';
import { app, type RelaunchOptions } from 'electron';

import localConfig from './localConfig';

export const buildRelaunchOptions = (
  args: readonly string[] = process.argv.slice(1),
  exactWindowPlacement = localConfig.get('exactWindowPlacement'),
): RelaunchOptions => ({
  args: [
    ...args.filter(
      arg =>
        exactWindowPlacement ||
        (arg !== '--ozone-platform' && !arg.startsWith('--ozone-platform=')),
    ),
    '--relaunch',
  ],
  execPath: process.execPath,
});

let restart = false;

export const needRestart = (val?: true) => {
  if (val) restart = val;
  return restart;
};

export default () => {
  if (import.meta.env.PROD) {
    needRestart(true);
    const options = buildRelaunchOptions();
    // Fix for .AppImage
    const AppImage = process.env.APPIMAGE;
    if (app.isPackaged && AppImage) {
      execFile(AppImage, options.args);
    } else {
      app.relaunch(options);
    }
  }
  app.quit();
};
