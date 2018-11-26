"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _debug = _interopRequireDefault(require("debug"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _serialport = _interopRequireDefault(require("serialport"));

var _usbDetection = _interopRequireDefault(require("usb-detection"));

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _events = require("events");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:detector');

const detectionPath = _path.default.resolve(__dirname, '../../detection.yml');

const knownPorts = [];

const loadDetection = () => {
  try {
    const data = _fs.default.readFileSync(detectionPath, 'utf8');

    const result = _jsYaml.default.safeLoad(data);

    Object.keys(result.mibCategories).forEach(category => {
      result.mibCategories[category].category = category;
    });
    return result;
  } catch (err) {
    debug(`Error: failed to read file ${detectionPath} (${err.message})`);
    return undefined;
  }
};

let detection = loadDetection();
/**
 * @fires add
 * @fires remove
 * @fires plug
 * @fires unplug
 */

class Detector extends _events.EventEmitter {
  start() {
    _usbDetection.default.startMonitoring();
  }

  stop() {
    _usbDetection.default.stopMonitoring();
  }

  restart() {
    _usbDetection.default.stopMonitoring();

    process.nextTick(() => _usbDetection.default.startMonitoring());
  }

  get ports() {
    return knownPorts;
  }

  get detection() {
    return detection;
  }

}

const detector = new Detector(); // interface ISerialPort {
//   comName: string;
//   locationId?: string;
//   manufacturer?: string;
//   pnpId?: string;
//   productId: HexOrNumber;
//   serialNumber: string;
//   vendorId: HexOrNumber;
// }

const getId = id => typeof id === 'string' ? parseInt(id, 16) : id;

function equals(port, device) {
  return getId(port.productId) === device.productId && getId(port.vendorId) === device.vendorId && port.serialNumber === device.serialNumber;
}

async function detectDevice(port, lastAdded) {
  let detected;

  if (lastAdded && equals(port, lastAdded)) {
    detected = lastAdded;
  } else {
    let list = await _usbDetection.default.find(getId(port.vendorId), getId(port.productId), () => {});
    const {
      serialNumber,
      manufacturer
    } = port;
    list = _lodash.default.filter(list, {
      serialNumber,
      manufacturer
    });

    if (list.length === 0) {
      debug(`Unknown device ${JSON.stringify(port)}`);
    } else if (list.length > 1) {
      debug(`can't identify device ${JSON.stringify(port)}`);
    } else {
      [detected] = list;
    }
  }

  if (detected !== undefined) {
    const {
      productId,
      vendorId,
      deviceName: device
    } = detected;
    return { ...port,
      productId,
      vendorId,
      device
    };
  }

  return { ...port,
    productId: getId(port.productId),
    vendorId: getId(port.vendorId)
  };
} // const loadDetection = () => new Promise<IDetection>((resolve, reject) => {
//   fs.readFile(detectionPath, 'utf8', (err, data) => {
//     if (err) {
//       reject(`Error: failed to read file ${detectionPath} (${err.message})`);
//     } else {
//       const result = yaml.safeLoad(data) as IDetection;
//       Object.keys(result.mibCategories).forEach((category) => {
//         result.mibCategories[category].category = category;
//       });
//       resolve(result);
//     }
//   });
// });


const matchCategory = port => {
  const match = detection && _lodash.default.find(detection.knownDevices, item => port.device && port.device.startsWith(item.device) && (!item.serialNumber || port.serialNumber && port.serialNumber.startsWith(item.serialNumber)) && (!item.manufacturer || port.manufacturer === item.manufacturer) && getId(item.vid) === port.vendorId && getId(item.pid) === port.productId);

  if (match) return match.category;
};

async function reloadDevices(lastAdded) {
  try {
    if (detection == null) {
      detection = loadDetection();
    }

    const list = await _serialport.default.list();
    const externalPorts = list.filter(port => !!port.productId);
    const prevPorts = knownPorts.splice(0);
    await externalPorts.reduce(async (promise, port) => {
      await promise;

      const prev = _lodash.default.findIndex(prevPorts, {
        comName: port.comName
      });

      let device;

      if (prev !== -1) {
        [device] = prevPorts.splice(prev, 1);
        const category = matchCategory(device);

        if (category !== device.category) {
          debug(`device's category was changed ${device.category} to ${category}`);
          device.category && detector.emit('remove', device);
          device.category = category;
          device.category && detector.emit('add', device);
        }
      } else {
        device = await detectDevice(port, lastAdded);
        device.category = matchCategory(device);
        /**
         * new device plugged
         * @event Detector#plug
         */

        detector.emit('plug', device);
        debug(`new device ${device.device || device.vendorId}/\
${device.category || device.productId} was plugged to ${device.comName}`);

        if (device.category) {
          /**
           * device with category was added
           * @event Detector#add
           * @param {IKnownPort} device
           */
          detector.emit('add', device);
        }
      }

      knownPorts.push(device);
    }, Promise.resolve());
    prevPorts.forEach(port => {
      /**
       * @event Detector#unplug
       */
      detector.emit('unplug', port);
      debug(`device ${port.device || port.vendorId}/\
${port.category || port.productId} was unplugged from ${port.comName}`);
      /**
       * device with category was removed
       * @event Detector#remove
       * @param {IKnownPort} device
       */

      port.category && detector.emit('remove', port);
    });
  } catch (err) {
    debug(`Error: reload devices was failed (${err.message || err})`);
  }
}

debug(`start watching the detector file ${detectionPath}`);

_fs.default.watchFile(detectionPath, {
  persistent: false
}, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    debug(`detection file was changed, reloading devices...`);
    detection = undefined;
    reloadDevices().catch();
  }
});

reloadDevices().catch();

const reload = _lodash.default.debounce(reloadDevices, 2000);

_usbDetection.default.on('add', usbDevice => {
  debug('added', JSON.stringify(usbDevice));
  reload(usbDevice);
});

_usbDetection.default.on('remove', usbDevice => {
  debug('removed', JSON.stringify(usbDevice));
  reloadDevices(usbDevice).catch();
});

var _default = detector;
exports.default = _default;