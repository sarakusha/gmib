#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const electronPackageDir = path.dirname(require.resolve('electron/package.json'));

const electronBinaryByPlatform = {
  darwin: path.join(electronPackageDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  win32: path.join(electronPackageDir, 'dist', 'electron.exe'),
  linux: path.join(electronPackageDir, 'dist', 'electron'),
};

const electronBinary = electronBinaryByPlatform[process.platform] || electronBinaryByPlatform.linux;

if (!existsSync(electronBinary)) {
  const installResult = spawnSync(process.execPath, [path.join(electronPackageDir, 'install.js')], {
    stdio: 'inherit',
  });

  if (installResult.error) {
    throw installResult.error;
  }

  if (installResult.status !== 0 || !existsSync(electronBinary)) {
    console.error(`Electron installation did not create ${electronBinary}`);
    process.exit(installResult.status || 1);
  }
}

const result = spawnSync(electronBinary, [path.join(__dirname, 'update-electron-vendors.js')], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
