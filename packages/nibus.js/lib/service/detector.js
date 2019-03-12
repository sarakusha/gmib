"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _fs = _interopRequireDefault(require("fs"));

var _PathReporter = require("io-ts/lib/PathReporter");

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

var _serialport = _interopRequireDefault(require("serialport"));

var _KnownPorts = require("./KnownPorts");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* tslint:disable:variable-name */
let usbDetection;
const debug = (0, _debug.default)('nibus:detector');

const detectionPath = _path.default.resolve(__dirname, '../../detection.yml');

let knownPorts = Promise.resolve([]);

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

function reloadDevices(lastAdded) {
  knownPorts = knownPorts.then(ports => reloadDevicesAsync(ports, lastAdded));
}

const detectionListener = (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    debug(`detection file was changed, reloading devices...`);
    detection = undefined;
    reloadDevices();
  }
};
/**
 * @fires add
 * @fires remove
 * @fires plug
 * @fires unplug
 */


class Detector extends _events.EventEmitter {
  start() {
    usbDetection = require('usb-detection');
    usbDetection.startMonitoring();
    debug(`start watching the detector file ${detectionPath}`);

    _fs.default.watchFile(detectionPath, {
      persistent: false
    }, detectionListener); // detection = loadDetection();


    reloadDevices(); // Должна быть debounce с задержкой, иначе Serial.list не определит

    usbDetection.on('add', reload); // Удаление без задержки!

    usbDetection.on('remove', reloadDevices);
  }

  stop() {
    _fs.default.unwatchFile(detectionPath, detectionListener);

    usbDetection && usbDetection.stopMonitoring();
  }

  restart() {
    if (!usbDetection) return this.start();
    usbDetection.stopMonitoring();
    process.nextTick(() => usbDetection.startMonitoring());
  }

  async getPorts() {
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
// type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
//
// export interface IKnownPort extends Omit<SerialPort.PortInfo, 'productId' | 'vendorId'> {
//   device?: string;
//   productId: number;
//   vendorId: number;
//   category?: string;
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
    let list = await usbDetection.find(getId(port.vendorId), getId(port.productId), () => {});
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
      deviceName: device,
      deviceAddress
    } = detected;
    return { ...port,
      productId,
      vendorId,
      device,
      deviceAddress
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

  if (match) return _KnownPorts.CategoryV.decode(match.category).getOrElse(undefined);
};

async function reloadDevicesAsync(prevPorts, lastAdded) {
  const ports = [];

  try {
    if (detection == null) {
      detection = loadDetection();
    }

    const list = await _serialport.default.list();
    const externalPorts = list.filter(port => !!port.productId); // const prevPorts = knownPorts.splice(0);

    await externalPorts.reduce(async (promise, port) => {
      const nextPorts = await promise;

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
          device.category = _KnownPorts.CategoryV.decode(category).getOrElse(undefined);
          device.category && detector.emit('add', device);
        }
      } else {
        device = await detectDevice(port, lastAdded);
        device.category = matchCategory(device);
        /**
         * new device plugged
         * @event Detector#plug
         */

        detector.emit('plug', device); // console.log('PORT', JSON.stringify(port));
        // console.log('DEV', JSON.stringify(device));

        if (device.category) {
          debug(`new device ${device.device || device.vendorId}/\
${device.category} was plugged to ${device.comName}`);
          detector.emit('add', device);
        } else {
          debug(`unknown device %o was plugged`, device);
        }
      }

      const validation = _KnownPorts.KnownPortV.decode(device);

      if (validation.isLeft()) {
        debug('<error>', _PathReporter.PathReporter.report(validation));
      } else {
        nextPorts.push(validation.value);
      }

      return nextPorts;
    }, Promise.resolve(ports));
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
    return ports;
  } catch (err) {
    debug(`Error: reload devices was failed (${err.stack || err.message || err})`);
    return ports;
  }
} // debug(`start watching the detector file ${detectionPath}`);
// fs.watchFile(detectionPath, { persistent: false }, (curr, prev) => {
//   if (curr.mtime !== prev.mtime) {
//     debug(`detection file was changed, reloading devices...`);
//     detection = undefined;
//     reloadDevices().catch();
//   }
// });
// reloadDevices();


const reload = _lodash.default.debounce(reloadDevices, 2000);

var _default = detector;
exports.default = _default;