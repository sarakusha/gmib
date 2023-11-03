import { execFile } from 'child_process';
import { app, type RelaunchOptions } from 'electron';

const options: RelaunchOptions = {
  args: process.argv.slice(1).concat(['--relaunch']),
  execPath: process.execPath,
};

let restart = false;

export const needRestart = (val?: true) => {
  if (val) restart = val;
  return restart;
};

export default () => {
  if (import.meta.env.PROD) {
    needRestart(true);
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
