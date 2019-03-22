import _ from 'lodash';
import SerialPort from 'serialport';
import usbDetection from 'usb-detection';
import NibusDecoder from '../nibus/NibusDecoder';
import NibusEncoder from '../nibus/NibusEncoder';
import { NmsDatagram } from '../nms';
import { createSarp, SarpQueryType } from '../sarp';

const vid = '0403';
const pid = '6001';

function delay(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

// interface ISerialPortType {
//   comName: string;
//   manufacturer: string;
//   serialNumber: string;
//   pnpId?: any;
//   locationId: string;
//   vendorId: string;
//   productId: string;
// }

// usbDetection.on(`add:${parseInt(vid, 16)}:${parseInt(pid, 16)}`, (device) => {
usbDetection.on(`add`, (device) => {
  console.debug('#### add', device);
  delay(1000).then(() => findAll());
});

function findAll() {
  SerialPort.list()
    .then((list) => {
      list.filter(item => !!item.vendorId)
        .forEach(data => console.info(JSON.stringify(data)));
      console.info('=====================================================');
    });
    // .then(() => {
    //   usbDetection.find((err, list) => {
    //     list && list.forEach(console.info);
    //     console.info('_++++++++++++++++++++++++++++++++++++++++++++++++');
    //   });
    // });
}

function find() {
  return SerialPort.list()
    .then((list) => {
      const [port] = _.filter(
        list,
        {
          productId: pid,
          vendorId: vid,
        },
      );
      if (!port) {
        throw Error('no devices');
      }
      console.debug('FOUND', port);
      const siolynx = new SerialPort(port.comName, {
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });
      // const pass = new PassThrough();
      // const file = fs.createWriteStream('/Users/sarakusha/test-nibus.txt');
      siolynx.on('open', () => console.debug('PORT OPENED'));
      // siolynx.on('data', (buffer) => console.debug('PORT DATA', buffer));
      siolynx.on('error', err => console.debug('PORT ERROR', err));
      const encoder = new NibusEncoder();
      encoder.on('error', err => console.debug('ENCODER ERROR', err));
      encoder.on('pipe', err => console.debug('ENCODER PIPE', err));
      const decoder = new NibusDecoder();
      decoder.on('data', (chunk: NmsDatagram) => {
        console.debug('RESP:', chunk, chunk.value.toString(16));
      });
      encoder.pipe(siolynx);
      siolynx.pipe(decoder);
      const datagram = createSarp(SarpQueryType.All); // createNmsRead('::6e:fa', 2);
      // const datagram = createNmsRead('::6e:fa', 2);
      console.debug('WRITING...', datagram.raw);

      const ping = () => {
        const result = encoder.write(datagram);
        console.debug('WRITE RESULT', result);
      };
      setInterval(ping, 1000);
    });
}

// find().catch(() => usbDetection.startMonitoring());
findAll();
usbDetection.startMonitoring();
