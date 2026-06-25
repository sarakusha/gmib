import { app } from 'electron';
import HID from 'node-hid';
import debugFactory from 'debug';

import config from './config';
import { getMainWindow } from './mainWindow';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:hid`);
const HID_POLL_INTERVAL = 2000;

let device: HID.HIDAsync | undefined;
let devicePath: string | undefined;
let updatePromise: Promise<void> | undefined;
let pollTimer: NodeJS.Timeout | undefined;
let isQuitting = false;

const listener = (data: Buffer) => {
  // debug(`data: ${data.toString('hex')}`);
  const { volumeUp, volumeDown } = config.get('hid') ?? {};
  const { webContents } = getMainWindow() ?? {};
  if (!webContents || webContents.isDestroyed()) return;
  if (data[0] === volumeUp) {
    // debug('brightnessUp');
    webContents.send('brightnessUp');
  } else if (data[0] === volumeDown) {
    // debug('brightnessDown');
    webContents.send('brightnessDown');
  }
};

const closeDevice = async () => {
  if (!device) return;
  const current = device;
  device = undefined;
  devicePath = undefined;
  current.off('data', listener);
  await current.close();
  debug('close device');
};

const updateHidImpl = async () => {
  if (isQuitting) return;
  const { VID, PID } = config.get('hid') ?? {};
  try {
    const [target] = VID && PID ? await HID.devicesAsync(VID, PID) : [];
    if (!target?.path) {
      await closeDevice();
      return;
    }
    if (device && devicePath === target.path) return;

    await closeDevice();
    if (VID && PID) {
      device = await HID.HIDAsync.open(target.path);
      devicePath = target.path;
      device.on('data', listener);
      debug('open device');
    }
  } catch (error) {
    debug('error while open: %s', (error as Error).message);
  }
};

const updateHid = (): void => {
  updatePromise ??= updateHidImpl().finally(() => {
    updatePromise = undefined;
  });
};

app.once('ready', () => {
  config.onDidChange('hid.PID', () => {
    updateHid();
  });
  config.onDidChange('hid.VID', () => {
    updateHid();
  });

  pollTimer = setInterval(updateHid, HID_POLL_INTERVAL);
  pollTimer.unref();
  updateHid();
});

app.once('before-quit', () => {
  isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
  void closeDevice();
});
