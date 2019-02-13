const usbDetect = require('usb-detection');

usbDetect.on('add', (device) => {
  console.log('changed', device);
});

usbDetect.startMonitoring();
process.on('SIGINT', () => {
  usbDetect.stopMonitoring();
  console.log('stop');
});
