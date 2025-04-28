import { app } from 'electron';
import HID from 'node-hid';
import { usb } from 'usb';
import debugFactory from 'debug';

import config from './config';
import { getMainWindow } from './mainWindow';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:hid`);

let device: HID.HIDAsync | undefined;

const listener = (data: Buffer) => {
  // debug(`data: ${data.toString('hex')}`);
  const { volumeUp, volumeDown } = config.get('hid') ?? {};
  const { webContents } = getMainWindow() ?? {};
  if (!webContents) return;
  if (data[0] === volumeUp) {
    // debug('brightnessUp');
    webContents.send('brightnessUp');
  } else if (data[0] === volumeDown) {
    // debug('brightnessDown');
    webContents.send('brightnessDown');
  }
};

const updateHid = async () => {
  const { VID, PID } = config.get('hid') ?? {};
  try {
    if (device) {
      device.off('data', listener);
      await device.close();
      debug('close device');
      device = undefined;
    }
    if (VID && PID) {
      const devices = await HID.devicesAsync();
      if (devices.find(item => item.vendorId === VID && item.productId === PID)) {
        device = await HID.HIDAsync.open(VID, PID);
        device.on('data', listener);
        debug('open device');
      }
    }
  } catch (error) {
    debug('error while open: %s', (error as Error).message);
  }
};

const usbListener = (usbDevice: usb.Device): void => {
  const { VID, PID } = config.get('hid') ?? {};
  if (PID && usbDevice.deviceDescriptor.idProduct === PID && VID && usbDevice.deviceDescriptor.idVendor)
    updateHid();
};

app.once('ready', () => {
  config.onDidChange('hid.PID', updateHid);
  config.onDidChange('hid.VID', updateHid);

  usb.on('attach', usbListener);
  usb.on('detach', usbListener);

  updateHid();
});

app.once('quit', () => {
  if (device) device.close();
});
