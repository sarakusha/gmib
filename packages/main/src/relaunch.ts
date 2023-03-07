import { execFile } from 'child_process';
import { app, type RelaunchOptions } from 'electron';

const options: RelaunchOptions = {
  args: process.argv.slice(1).concat(['--relaunch']),
  execPath: process.execPath,
};

export default () => {
  // Fix for .AppImage
  const AppImage = process.env.APPIMAGE;
  if (app.isPackaged && AppImage) {
    execFile(AppImage, options.args);
    app.quit();
    return;
  }
  app.relaunch(options);
  app.quit();
};
