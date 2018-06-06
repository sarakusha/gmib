import usbDetect from 'usb-detection';
import serialport from 'serialport';
import _ from 'lodash';

const vid = '0403';
const pid = '6001';

function delay(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

usbDetect.on(`add:${parseInt(vid, 16)}:${parseInt(pid, 16)}`, (device) => {
  console.log('change', device);
  delay(1000)
    .then(() => serialport.list())
    .then((list) => {
      console.log(_.filter(
        list,
        {
          vendorId: vid,
          productId: pid,
        },
      ));
    });
});

usbDetect.startMonitoring();
