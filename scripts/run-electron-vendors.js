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
  console.warn(`Skipping Electron vendor update: missing ${electronBinary}`);
  process.exit(0);
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
