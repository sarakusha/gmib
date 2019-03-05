"use strict";

var _lodash = _interopRequireDefault(require("lodash"));

var _serialport = _interopRequireDefault(require("serialport"));

var _usbDetection = _interopRequireDefault(require("usb-detection"));

var _NibusDecoder = _interopRequireDefault(require("../nibus/NibusDecoder"));

var _NibusEncoder = _interopRequireDefault(require("../nibus/NibusEncoder"));

var _sarp = require("../sarp");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const vid = '0403';
const pid = '6001';

function delay(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
} // interface ISerialPortType {
//   comName: string;
//   manufacturer: string;
//   serialNumber: string;
//   pnpId?: any;
//   locationId: string;
//   vendorId: string;
//   productId: string;
// }
// usbDetection.on(`add:${parseInt(vid, 16)}:${parseInt(pid, 16)}`, (device) => {


_usbDetection.default.on(`add`, device => {
  console.debug('#### add', device);
  delay(1000).then(() => findAll());
});

function findAll() {
  _serialport.default.list().then(list => {
    list.filter(item => !!item.vendorId).forEach(data => console.info(JSON.stringify(data)));
    console.info('=====================================================');
  }); // .then(() => {
  //   usbDetection.find((err, list) => {
  //     list && list.forEach(console.info);
  //     console.info('_++++++++++++++++++++++++++++++++++++++++++++++++');
  //   });
  // });

}

function find() {
  return _serialport.default.list().then(list => {
    const [port] = _lodash.default.filter(list, {
      productId: pid,
      vendorId: vid
    });

    if (!port) {
      throw Error('no devices');
    }

    console.debug('FOUND', port);
    const siolynx = new _serialport.default(port.comName, {
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1
    }); // const pass = new PassThrough();
    // const file = fs.createWriteStream('/Users/sarakusha/test-nibus.txt');

    siolynx.on('open', () => console.debug('PORT OPENED')); // siolynx.on('data', (buffer) => console.debug('PORT DATA', buffer));

    siolynx.on('error', err => console.debug('PORT ERROR', err));
    const encoder = new _NibusEncoder.default();
    encoder.on('error', err => console.debug('ENCODER ERROR', err));
    encoder.on('pipe', err => console.debug('ENCODER PIPE', err));
    const decoder = new _NibusDecoder.default();
    decoder.on('data', chunk => {
      console.debug('RESP:', chunk, chunk.value.toString(16));
    });
    encoder.pipe(siolynx);
    siolynx.pipe(decoder);
    const datagram = (0, _sarp.createSarp)(_sarp.SarpQueryType.All); // createNmsRead('::6e:fa', 2);
    // const datagram = createNmsRead('::6e:fa', 2);

    console.debug('WRITING...', datagram.raw);

    const ping = () => {
      const result = encoder.write(datagram);
      console.debug('WRITE RESULT', result);
    };

    setInterval(ping, 1000);
  });
} // find().catch(() => usbDetection.startMonitoring());


findAll();

_usbDetection.default.startMonitoring();