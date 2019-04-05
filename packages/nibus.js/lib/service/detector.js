"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _fs = _interopRequireDefault(require("fs"));

var _PathReporter = require("io-ts/lib/PathReporter");

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

var _serialport = _interopRequireDefault(require("serialport"));

var _KnownPorts = require("@nata/nibus.js-client/lib/session/KnownPorts");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

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

        if (device.category) {
          debug(`new device ${device.device || device.vendorId}/\
${device.category} was plugged to ${device.comName}`);
          detector.emit('add', device);
        } else {
          debug('unknown device %o was plugged', device);
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
    debug(`Error: reload devices was failed (${err.message || err})`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2aWNlL2RldGVjdG9yLnRzIl0sIm5hbWVzIjpbInVzYkRldGVjdGlvbiIsImRlYnVnIiwiZGV0ZWN0aW9uUGF0aCIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwia25vd25Qb3J0cyIsIlByb21pc2UiLCJsb2FkRGV0ZWN0aW9uIiwiZGF0YSIsImZzIiwicmVhZEZpbGVTeW5jIiwicmVzdWx0IiwieWFtbCIsInNhZmVMb2FkIiwiT2JqZWN0Iiwia2V5cyIsIm1pYkNhdGVnb3JpZXMiLCJmb3JFYWNoIiwiY2F0ZWdvcnkiLCJlcnIiLCJtZXNzYWdlIiwidW5kZWZpbmVkIiwiZGV0ZWN0aW9uIiwicmVsb2FkRGV2aWNlcyIsImxhc3RBZGRlZCIsInRoZW4iLCJwb3J0cyIsInJlbG9hZERldmljZXNBc3luYyIsImRldGVjdGlvbkxpc3RlbmVyIiwiY3VyciIsInByZXYiLCJtdGltZSIsIkRldGVjdG9yIiwiRXZlbnRFbWl0dGVyIiwic3RhcnQiLCJyZXF1aXJlIiwic3RhcnRNb25pdG9yaW5nIiwid2F0Y2hGaWxlIiwicGVyc2lzdGVudCIsIm9uIiwicmVsb2FkIiwic3RvcCIsInVud2F0Y2hGaWxlIiwic3RvcE1vbml0b3JpbmciLCJyZXN0YXJ0IiwicHJvY2VzcyIsIm5leHRUaWNrIiwiZ2V0UG9ydHMiLCJkZXRlY3RvciIsImdldElkIiwiaWQiLCJwYXJzZUludCIsImVxdWFscyIsInBvcnQiLCJkZXZpY2UiLCJwcm9kdWN0SWQiLCJ2ZW5kb3JJZCIsInNlcmlhbE51bWJlciIsImRldGVjdERldmljZSIsImRldGVjdGVkIiwibGlzdCIsImZpbmQiLCJtYW51ZmFjdHVyZXIiLCJfIiwiZmlsdGVyIiwibGVuZ3RoIiwiSlNPTiIsInN0cmluZ2lmeSIsImRldmljZU5hbWUiLCJkZXZpY2VBZGRyZXNzIiwibWF0Y2hDYXRlZ29yeSIsIm1hdGNoIiwia25vd25EZXZpY2VzIiwiaXRlbSIsInN0YXJ0c1dpdGgiLCJ2aWQiLCJwaWQiLCJDYXRlZ29yeVYiLCJkZWNvZGUiLCJnZXRPckVsc2UiLCJwcmV2UG9ydHMiLCJTZXJpYWxQb3J0IiwiZXh0ZXJuYWxQb3J0cyIsInJlZHVjZSIsInByb21pc2UiLCJuZXh0UG9ydHMiLCJmaW5kSW5kZXgiLCJjb21OYW1lIiwic3BsaWNlIiwiZW1pdCIsInZhbGlkYXRpb24iLCJLbm93blBvcnRWIiwiaXNMZWZ0IiwiUGF0aFJlcG9ydGVyIiwicmVwb3J0IiwicHVzaCIsInZhbHVlIiwiZGVib3VuY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVdBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOzs7O0FBcEJBOzs7Ozs7Ozs7O0FBVUE7QUFtQkEsSUFBSUEsWUFBSjtBQUNBLE1BQU1DLEtBQUssR0FBRyxvQkFBYSxnQkFBYixDQUFkOztBQUNBLE1BQU1DLGFBQWEsR0FBR0MsY0FBS0MsT0FBTCxDQUFhQyxTQUFiLEVBQXdCLHFCQUF4QixDQUF0Qjs7QUFDQSxJQUFJQyxVQUFpQyxHQUFHQyxPQUFPLENBQUNILE9BQVIsQ0FBZ0IsRUFBaEIsQ0FBeEM7O0FBa0JBLE1BQU1JLGFBQWEsR0FBRyxNQUE4QjtBQUNsRCxNQUFJO0FBQ0YsVUFBTUMsSUFBSSxHQUFHQyxZQUFHQyxZQUFILENBQWdCVCxhQUFoQixFQUErQixNQUEvQixDQUFiOztBQUNBLFVBQU1VLE1BQU0sR0FBR0MsZ0JBQUtDLFFBQUwsQ0FBY0wsSUFBZCxDQUFmOztBQUNBTSxJQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWUosTUFBTSxDQUFDSyxhQUFuQixFQUFrQ0MsT0FBbEMsQ0FBMkNDLFFBQUQsSUFBYztBQUN0RFAsTUFBQUEsTUFBTSxDQUFDSyxhQUFQLENBQXFCRSxRQUFyQixFQUErQkEsUUFBL0IsR0FBMENBLFFBQTFDO0FBQ0QsS0FGRDtBQUdBLFdBQU9QLE1BQVA7QUFDRCxHQVBELENBT0UsT0FBT1EsR0FBUCxFQUFZO0FBQ1puQixJQUFBQSxLQUFLLENBQUUsOEJBQTZCQyxhQUFj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Q0FBb0JKLFVBQXBCLENBQVosQ0FBTDtBQUNELE9BRkQsTUFFTztBQUNMTCxRQUFBQSxTQUFTLENBQUNVLElBQVYsQ0FBZUwsVUFBVSxDQUFDTSxLQUExQjtBQUNEOztBQUNELGFBQU9YLFNBQVA7QUFDRCxLQXJDSyxFQXFDSC9FLE9BQU8sQ0FBQ0gsT0FBUixDQUFnQnVCLEtBQWhCLENBckNHLENBQU47QUFzQ0FzRCxJQUFBQSxTQUFTLENBQUMvRCxPQUFWLENBQW1Cb0MsSUFBRCxJQUFVO0FBQzFCOzs7QUFHQUwsTUFBQUEsUUFBUSxDQUFDeUMsSUFBVCxDQUFjLFFBQWQsRUFBd0JwQyxJQUF4QjtBQUNBckQsTUFBQUEsS0FBSyxDQUFFLFVBQVNxRCxJQUFJLENBQUNDLE1BQUwsSUFBZUQsSUFBSSxDQUFDRyxRQUFTO0VBQ2pESCxJQUFJLENBQUNuQyxRQUFMLElBQWlCbUMsSUFBSSxDQUFDRSxTQUFVLHVCQUFzQkYsSUFBSSxDQUFDa0MsT0FBUSxFQUQxRCxDQUFMO0FBRUE7Ozs7OztBQUtBbEMsTUFBQUEsSUFBSSxDQUFDbkMsUUFBTCxJQUFpQjhCLFFBQVEsQ0FBQ3lDLElBQVQsQ0FBYyxRQUFkLEVBQXdCcEMsSUFBeEIsQ0FBakI7QUFDRCxLQWJEO0FBY0EsV0FBTzNCLEtBQVA7QUFDRCxHQTdERCxDQTZERSxPQUFPUCxHQUFQLEVBQVk7QUFDWm5CLElBQUFBLEtBQUssQ0FBRSxxQ0FBb0NtQixHQUFHLENBQUNDLE9BQUosSUFBZUQsR0FBSSxHQUF6RCxDQUFMO0FBQ0EsV0FBT08sS0FBUDtBQUNEO0FBQ0YsQyxDQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTs7O0FBRUEsTUFBTWMsTUFBTSxHQUFHdUIsZ0JBQUVrQyxRQUFGLENBQVcxRSxhQUFYLEVBQTBCLElBQTFCLENBQWY7O2VBRWV5QixRIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbi8qIHRzbGludDpkaXNhYmxlOnZhcmlhYmxlLW5hbWUgKi9cbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBmcywgeyBTdGF0cyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IFBhdGhSZXBvcnRlciB9IGZyb20gJ2lvLXRzL2xpYi9QYXRoUmVwb3J0ZXInO1xuaW1wb3J0IHlhbWwgZnJvbSAnanMteWFtbCc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgU2VyaWFsUG9ydCBmcm9tICdzZXJpYWxwb3J0JztcbmltcG9ydCBVc2JEZXRlY3Rpb24gZnJvbSAndXNiLWRldGVjdGlvbic7XG5pbXBvcnQge1xuICBDYXRlZ29yeSxcbiAgQ2F0ZWdvcnlWLFxuICBIZXhPck51bWJlcixcbiAgSUtub3duUG9ydCxcbiAgSU1pYkRlc2NyaXB0aW9uLFxuICBLbm93blBvcnRWLFxufSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvbGliL3Nlc3Npb24vS25vd25Qb3J0cyc7XG5cbmxldCB1c2JEZXRlY3Rpb246IHR5cGVvZiBVc2JEZXRlY3Rpb247XG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmlidXM6ZGV0ZWN0b3InKTtcbmNvbnN0IGRldGVjdGlvblBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vZGV0ZWN0aW9uLnltbCcpO1xubGV0IGtub3duUG9ydHM6IFByb21pc2U8SUtub3duUG9ydFtdPiA9IFByb21pc2UucmVzb2x2ZShbXSk7XG5cbmludGVyZmFjZSBJRGV0ZWN0b3JJdGVtIHtcbiAgZGV2aWNlOiBzdHJpbmc7XG4gIHZpZDogSGV4T3JOdW1iZXI7XG4gIHBpZDogSGV4T3JOdW1iZXI7XG4gIG1hbnVmYWN0dXJlcj86IHN0cmluZztcbiAgc2VyaWFsTnVtYmVyPzogc3RyaW5nO1xuICBjYXRlZ29yeTogQ2F0ZWdvcnk7XG59XG5cbmludGVyZmFjZSBJRGV0ZWN0aW9uIHtcbiAgbWliQ2F0ZWdvcmllczoge1xuICAgIFtjYXRlZ29yeTogc3RyaW5nXTogSU1pYkRlc2NyaXB0aW9uLFxuICB9O1xuICBrbm93bkRldmljZXM6IElEZXRlY3Rvckl0ZW1bXTtcbn1cblxuY29uc3QgbG9hZERldGVjdGlvbiA9ICgpOiBJRGV0ZWN0aW9uIHwgdW5kZWZpbmVkID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGRldGVjdGlvblBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0geWFtbC5zYWZlTG9hZChkYXRhKSBhcyBJRGV0ZWN0aW9uO1xuICAgIE9iamVjdC5rZXlzKHJlc3VsdC5taWJDYXRlZ29yaWVzKS5mb3JFYWNoKChjYXRlZ29yeSkgPT4ge1xuICAgICAgcmVzdWx0Lm1pYkNhdGVnb3JpZXNbY2F0ZWdvcnldLmNhdGVnb3J5ID0gY2F0ZWdvcnk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZGVidWcoYEVycm9yOiBmYWlsZWQgdG8gcmVhZCBmaWxlICR7ZGV0ZWN0aW9uUGF0aH0gKCR7ZXJyLm1lc3NhZ2V9KWApO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn07XG5cbmxldCBkZXRlY3Rpb24gPSBsb2FkRGV0ZWN0aW9uKCk7XG5cbmZ1bmN0aW9uIHJlbG9hZERldmljZXMobGFzdEFkZGVkPzogVXNiRGV0ZWN0aW9uLklEZXZpY2UpIHtcbiAga25vd25Qb3J0cyA9IGtub3duUG9ydHMudGhlbihwb3J0cyA9PiByZWxvYWREZXZpY2VzQXN5bmMocG9ydHMsIGxhc3RBZGRlZCkpO1xufVxuXG5jb25zdCBkZXRlY3Rpb25MaXN0ZW5lciA9IChjdXJyOiBTdGF0cywgcHJldjogU3RhdHMpID0+IHtcbiAgaWYgKGN1cnIubXRpbWUgIT09IHByZXYubXRpbWUpIHtcbiAgICBkZWJ1ZyhgZGV0ZWN0aW9uIGZpbGUgd2FzIGNoYW5nZWQsIHJlbG9hZGluZyBkZXZpY2VzLi4uYCk7XG4gICAgZGV0ZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgIHJlbG9hZERldmljZXMoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBAZmlyZXMgYWRkXG4gKiBAZmlyZXMgcmVtb3ZlXG4gKiBAZmlyZXMgcGx1Z1xuICogQGZpcmVzIHVucGx1Z1xuICovXG5jbGFzcyBEZXRlY3RvciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIHN0YXJ0KCkge1xuICAgIHVzYkRldGVjdGlvbiA9IHJlcXVpcmUoJ3VzYi1kZXRlY3Rpb24nKTtcbiAgICB1c2JEZXRlY3Rpb24uc3RhcnRNb25pdG9yaW5nKCk7XG4gICAgZGVidWcoYHN0YXJ0IHdhdGNoaW5nIHRoZSBkZXRlY3RvciBmaWxlICR7ZGV0ZWN0aW9uUGF0aH1gKTtcbiAgICBmcy53YXRjaEZpbGUoZGV0ZWN0aW9uUGF0aCwgeyBwZXJzaXN0ZW50OiBmYWxzZSB9LCBkZXRlY3Rpb25MaXN0ZW5lcik7XG4gICAgLy8gZGV0ZWN0aW9uID0gbG9hZERldGVjdGlvbigpO1xuICAgIHJlbG9hZERldmljZXMoKTtcbiAgICAvLyDQlNC+0LvQttC90LAg0LHRi9GC0YwgZGVib3VuY2Ug0YEg0LfQsNC00LXRgNC20LrQvtC5LCDQuNC90LDRh9C1IFNlcmlhbC5saXN0INC90LUg0L7Qv9GA0LXQtNC10LvQuNGCXG4gICAgdXNiRGV0ZWN0aW9uLm9uKCdhZGQnLCByZWxvYWQpO1xuICAgIC8vINCj0LTQsNC70LXQvdC40LUg0LHQtdC3INC30LDQtNC10YDQttC60LghXG4gICAgdXNiRGV0ZWN0aW9uLm9uKCdyZW1vdmUnLCByZWxvYWREZXZpY2VzKTtcbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgZnMudW53YXRjaEZpbGUoZGV0ZWN0aW9uUGF0aCwgZGV0ZWN0aW9uTGlzdGVuZXIpO1xuICAgIHVzYkRldGVjdGlvbiAmJiB1c2JEZXRlY3Rpb24uc3RvcE1vbml0b3JpbmcoKTtcbiAgfVxuXG4gIHJlc3RhcnQoKSB7XG4gICAgaWYgKCF1c2JEZXRlY3Rpb24pIHJldHVybiB0aGlzLnN0YXJ0KCk7XG4gICAgdXNiRGV0ZWN0aW9uLnN0b3BNb25pdG9yaW5nKCk7XG4gICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB1c2JEZXRlY3Rpb24uc3RhcnRNb25pdG9yaW5nKCkpO1xuICB9XG5cbiAgYXN5bmMgZ2V0UG9ydHMoKSB7XG4gICAgcmV0dXJuIGtub3duUG9ydHM7XG4gIH1cblxuICBnZXQgZGV0ZWN0aW9uKCk6IElEZXRlY3Rpb24gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiBkZXRlY3Rpb247XG4gIH1cbn1cblxuY29uc3QgZGV0ZWN0b3IgPSBuZXcgRGV0ZWN0b3IoKTtcblxuLy8gaW50ZXJmYWNlIElTZXJpYWxQb3J0IHtcbi8vICAgY29tTmFtZTogc3RyaW5nO1xuLy8gICBsb2NhdGlvbklkPzogc3RyaW5nO1xuLy8gICBtYW51ZmFjdHVyZXI/OiBzdHJpbmc7XG4vLyAgIHBucElkPzogc3RyaW5nO1xuLy8gICBwcm9kdWN0SWQ6IEhleE9yTnVtYmVyO1xuLy8gICBzZXJpYWxOdW1iZXI6IHN0cmluZztcbi8vICAgdmVuZG9ySWQ6IEhleE9yTnVtYmVyO1xuLy8gfVxuXG4vLyB0eXBlIE9taXQ8VCwgSyBleHRlbmRzIGtleW9mIFQ+ID0gUGljazxULCBFeGNsdWRlPGtleW9mIFQsIEs+Pjtcbi8vXG4vLyBleHBvcnQgaW50ZXJmYWNlIElLbm93blBvcnQgZXh0ZW5kcyBPbWl0PFNlcmlhbFBvcnQuUG9ydEluZm8sICdwcm9kdWN0SWQnIHwgJ3ZlbmRvcklkJz4ge1xuLy8gICBkZXZpY2U/OiBzdHJpbmc7XG4vLyAgIHByb2R1Y3RJZDogbnVtYmVyO1xuLy8gICB2ZW5kb3JJZDogbnVtYmVyO1xuLy8gICBjYXRlZ29yeT86IHN0cmluZztcbi8vIH1cblxuY29uc3QgZ2V0SWQgPSAoaWQ/OiBIZXhPck51bWJlcikgPT4gdHlwZW9mIGlkID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KGlkLCAxNikgOiBpZDtcblxuZnVuY3Rpb24gZXF1YWxzKHBvcnQ6IFNlcmlhbFBvcnQuUG9ydEluZm8sIGRldmljZTogVXNiRGV0ZWN0aW9uLklEZXZpY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldElkKHBvcnQucHJvZHVjdElkKSA9PT0gZGV2aWNlLnByb2R1Y3RJZFxuICAgICYmIGdldElkKHBvcnQudmVuZG9ySWQpID09PSBkZXZpY2UudmVuZG9ySWRcbiAgICAmJiBwb3J0LnNlcmlhbE51bWJlciA9PT0gZGV2aWNlLnNlcmlhbE51bWJlcjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RGV2aWNlKHBvcnQ6IFNlcmlhbFBvcnQuUG9ydEluZm8sIGxhc3RBZGRlZD86IFVzYkRldGVjdGlvbi5JRGV2aWNlKVxuICA6IFByb21pc2U8SUtub3duUG9ydD4ge1xuICBsZXQgZGV0ZWN0ZWQ6IFVzYkRldGVjdGlvbi5JRGV2aWNlIHwgdW5kZWZpbmVkO1xuICBpZiAobGFzdEFkZGVkICYmIGVxdWFscyhwb3J0LCBsYXN0QWRkZWQpKSB7XG4gICAgZGV0ZWN0ZWQgPSBsYXN0QWRkZWQ7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGxpc3QgPSBhd2FpdCB1c2JEZXRlY3Rpb24uZmluZChnZXRJZChwb3J0LnZlbmRvcklkKSEsIGdldElkKHBvcnQucHJvZHVjdElkKSEsICgpID0+IHt9KTtcbiAgICBjb25zdCB7IHNlcmlhbE51bWJlciwgbWFudWZhY3R1cmVyIH0gPSBwb3J0O1xuICAgIGxpc3QgPSBfLmZpbHRlcihcbiAgICAgIGxpc3QsXG4gICAgICB7XG4gICAgICAgIHNlcmlhbE51bWJlcixcbiAgICAgICAgbWFudWZhY3R1cmVyLFxuICAgICAgfSxcbiAgICApO1xuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVidWcoYFVua25vd24gZGV2aWNlICR7SlNPTi5zdHJpbmdpZnkocG9ydCl9YCk7XG4gICAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA+IDEpIHtcbiAgICAgIGRlYnVnKGBjYW4ndCBpZGVudGlmeSBkZXZpY2UgJHtKU09OLnN0cmluZ2lmeShwb3J0KX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgW2RldGVjdGVkXSA9IGxpc3Q7XG4gICAgfVxuICB9XG4gIGlmIChkZXRlY3RlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgeyBwcm9kdWN0SWQsIHZlbmRvcklkLCBkZXZpY2VOYW1lOiBkZXZpY2UsIGRldmljZUFkZHJlc3MgfSA9IGRldGVjdGVkO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5wb3J0LFxuICAgICAgcHJvZHVjdElkLFxuICAgICAgdmVuZG9ySWQsXG4gICAgICBkZXZpY2UsXG4gICAgICBkZXZpY2VBZGRyZXNzLFxuICAgIH07XG4gIH1cbiAgcmV0dXJuIHtcbiAgICAuLi5wb3J0LFxuICAgIHByb2R1Y3RJZDogZ2V0SWQocG9ydC5wcm9kdWN0SWQpISxcbiAgICB2ZW5kb3JJZDogZ2V0SWQocG9ydC52ZW5kb3JJZCkhLFxuICB9O1xufVxuXG4vLyBjb25zdCBsb2FkRGV0ZWN0aW9uID0gKCkgPT4gbmV3IFByb21pc2U8SURldGVjdGlvbj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuLy8gICBmcy5yZWFkRmlsZShkZXRlY3Rpb25QYXRoLCAndXRmOCcsIChlcnIsIGRhdGEpID0+IHtcbi8vICAgICBpZiAoZXJyKSB7XG4vLyAgICAgICByZWplY3QoYEVycm9yOiBmYWlsZWQgdG8gcmVhZCBmaWxlICR7ZGV0ZWN0aW9uUGF0aH0gKCR7ZXJyLm1lc3NhZ2V9KWApO1xuLy8gICAgIH0gZWxzZSB7XG4vLyAgICAgICBjb25zdCByZXN1bHQgPSB5YW1sLnNhZmVMb2FkKGRhdGEpIGFzIElEZXRlY3Rpb247XG4vLyAgICAgICBPYmplY3Qua2V5cyhyZXN1bHQubWliQ2F0ZWdvcmllcykuZm9yRWFjaCgoY2F0ZWdvcnkpID0+IHtcbi8vICAgICAgICAgcmVzdWx0Lm1pYkNhdGVnb3JpZXNbY2F0ZWdvcnldLmNhdGVnb3J5ID0gY2F0ZWdvcnk7XG4vLyAgICAgICB9KTtcbi8vICAgICAgIHJlc29sdmUocmVzdWx0KTtcbi8vICAgICB9XG4vLyAgIH0pO1xuLy8gfSk7XG5cbmNvbnN0IG1hdGNoQ2F0ZWdvcnkgPSAocG9ydDogSUtub3duUG9ydCk6IENhdGVnb3J5ID0+IHtcbiAgY29uc3QgbWF0Y2ggPSBkZXRlY3Rpb24gJiYgXy5maW5kKFxuICAgIGRldGVjdGlvbiEua25vd25EZXZpY2VzLFxuICAgIGl0ZW0gPT4gKHBvcnQuZGV2aWNlICYmIHBvcnQuZGV2aWNlLnN0YXJ0c1dpdGgoaXRlbS5kZXZpY2UpKVxuICAgICAgJiYgKCFpdGVtLnNlcmlhbE51bWJlclxuICAgICAgICB8fCAocG9ydC5zZXJpYWxOdW1iZXIgJiYgcG9ydC5zZXJpYWxOdW1iZXIuc3RhcnRzV2l0aChpdGVtLnNlcmlhbE51bWJlcikpKVxuICAgICAgJiYgKCFpdGVtLm1hbnVmYWN0dXJlciB8fCAocG9ydC5tYW51ZmFjdHVyZXIgPT09IGl0ZW0ubWFudWZhY3R1cmVyKSlcbiAgICAgICYmIChnZXRJZChpdGVtLnZpZCkgPT09IHBvcnQudmVuZG9ySWQpICYmIChnZXRJZChpdGVtLnBpZCkgPT09IHBvcnQucHJvZHVjdElkKSxcbiAgKSBhcyBJRGV0ZWN0b3JJdGVtO1xuICBpZiAobWF0Y2gpIHJldHVybiBDYXRlZ29yeVYuZGVjb2RlKG1hdGNoLmNhdGVnb3J5KS5nZXRPckVsc2UodW5kZWZpbmVkKTtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbG9hZERldmljZXNBc3luYyhwcmV2UG9ydHM6IElLbm93blBvcnRbXSwgbGFzdEFkZGVkPzogVXNiRGV0ZWN0aW9uLklEZXZpY2UpIHtcbiAgY29uc3QgcG9ydHM6IElLbm93blBvcnRbXSA9IFtdO1xuICB0cnkge1xuICAgIGlmIChkZXRlY3Rpb24gPT0gbnVsbCkge1xuICAgICAgZGV0ZWN0aW9uID0gbG9hZERldGVjdGlvbigpO1xuICAgIH1cbiAgICBjb25zdCBsaXN0OiBTZXJpYWxQb3J0LlBvcnRJbmZvW10gPSBhd2FpdCBTZXJpYWxQb3J0Lmxpc3QoKTtcbiAgICBjb25zdCBleHRlcm5hbFBvcnRzID0gbGlzdC5maWx0ZXIocG9ydCA9PiAhIXBvcnQucHJvZHVjdElkKTtcbiAgICAvLyBjb25zdCBwcmV2UG9ydHMgPSBrbm93blBvcnRzLnNwbGljZSgwKTtcblxuICAgIGF3YWl0IGV4dGVybmFsUG9ydHMucmVkdWNlKGFzeW5jIChwcm9taXNlLCBwb3J0KSA9PiB7XG4gICAgICBjb25zdCBuZXh0UG9ydHMgPSBhd2FpdCBwcm9taXNlO1xuICAgICAgY29uc3QgcHJldiA9IF8uZmluZEluZGV4KHByZXZQb3J0cywgeyBjb21OYW1lOiBwb3J0LmNvbU5hbWUgfSk7XG4gICAgICBsZXQgZGV2aWNlOiBJS25vd25Qb3J0O1xuICAgICAgaWYgKHByZXYgIT09IC0xKSB7XG4gICAgICAgIFtkZXZpY2VdID0gcHJldlBvcnRzLnNwbGljZShwcmV2LCAxKTtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBtYXRjaENhdGVnb3J5KGRldmljZSk7XG4gICAgICAgIGlmIChjYXRlZ29yeSAhPT0gZGV2aWNlLmNhdGVnb3J5KSB7XG4gICAgICAgICAgZGVidWcoYGRldmljZSdzIGNhdGVnb3J5IHdhcyBjaGFuZ2VkICR7ZGV2aWNlLmNhdGVnb3J5fSB0byAke2NhdGVnb3J5fWApO1xuICAgICAgICAgIGRldmljZS5jYXRlZ29yeSAmJiBkZXRlY3Rvci5lbWl0KCdyZW1vdmUnLCBkZXZpY2UpO1xuICAgICAgICAgIGRldmljZS5jYXRlZ29yeSA9IENhdGVnb3J5Vi5kZWNvZGUoY2F0ZWdvcnkpLmdldE9yRWxzZSh1bmRlZmluZWQpO1xuICAgICAgICAgIGRldmljZS5jYXRlZ29yeSAmJiBkZXRlY3Rvci5lbWl0KCdhZGQnLCBkZXZpY2UpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXZpY2UgPSBhd2FpdCBkZXRlY3REZXZpY2UocG9ydCwgbGFzdEFkZGVkKTtcbiAgICAgICAgZGV2aWNlLmNhdGVnb3J5ID0gbWF0Y2hDYXRlZ29yeShkZXZpY2UpO1xuICAgICAgICAvKipcbiAgICAgICAgICogbmV3IGRldmljZSBwbHVnZ2VkXG4gICAgICAgICAqIEBldmVudCBEZXRlY3RvciNwbHVnXG4gICAgICAgICAqL1xuICAgICAgICBkZXRlY3Rvci5lbWl0KCdwbHVnJywgZGV2aWNlKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1BPUlQnLCBKU09OLnN0cmluZ2lmeShwb3J0KSk7XG4gICAgICAgIGlmIChkZXZpY2UuY2F0ZWdvcnkpIHtcbiAgICAgICAgICBkZWJ1ZyhgbmV3IGRldmljZSAke2RldmljZS5kZXZpY2UgfHwgZGV2aWNlLnZlbmRvcklkfS9cXFxuJHtkZXZpY2UuY2F0ZWdvcnl9IHdhcyBwbHVnZ2VkIHRvICR7ZGV2aWNlLmNvbU5hbWV9YCk7XG4gICAgICAgICAgZGV0ZWN0b3IuZW1pdCgnYWRkJywgZGV2aWNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWJ1ZygndW5rbm93biBkZXZpY2UgJW8gd2FzIHBsdWdnZWQnLCBkZXZpY2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB2YWxpZGF0aW9uID0gS25vd25Qb3J0Vi5kZWNvZGUoZGV2aWNlKTtcbiAgICAgIGlmICh2YWxpZGF0aW9uLmlzTGVmdCgpKSB7XG4gICAgICAgIGRlYnVnKCc8ZXJyb3I+JywgUGF0aFJlcG9ydGVyLnJlcG9ydCh2YWxpZGF0aW9uKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0UG9ydHMucHVzaCh2YWxpZGF0aW9uLnZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXh0UG9ydHM7XG4gICAgfSwgUHJvbWlzZS5yZXNvbHZlKHBvcnRzKSk7XG4gICAgcHJldlBvcnRzLmZvckVhY2goKHBvcnQpID0+IHtcbiAgICAgIC8qKlxuICAgICAgICogQGV2ZW50IERldGVjdG9yI3VucGx1Z1xuICAgICAgICovXG4gICAgICBkZXRlY3Rvci5lbWl0KCd1bnBsdWcnLCBwb3J0KTtcbiAgICAgIGRlYnVnKGBkZXZpY2UgJHtwb3J0LmRldmljZSB8fCBwb3J0LnZlbmRvcklkfS9cXFxuJHtwb3J0LmNhdGVnb3J5IHx8IHBvcnQucHJvZHVjdElkfSB3YXMgdW5wbHVnZ2VkIGZyb20gJHtwb3J0LmNvbU5hbWV9YCk7XG4gICAgICAvKipcbiAgICAgICAqIGRldmljZSB3aXRoIGNhdGVnb3J5IHdhcyByZW1vdmVkXG4gICAgICAgKiBAZXZlbnQgRGV0ZWN0b3IjcmVtb3ZlXG4gICAgICAgKiBAcGFyYW0ge0lLbm93blBvcnR9IGRldmljZVxuICAgICAgICovXG4gICAgICBwb3J0LmNhdGVnb3J5ICYmIGRldGVjdG9yLmVtaXQoJ3JlbW92ZScsIHBvcnQpO1xuICAgIH0pO1xuICAgIHJldHVybiBwb3J0cztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZGVidWcoYEVycm9yOiByZWxvYWQgZGV2aWNlcyB3YXMgZmFpbGVkICgke2Vyci5tZXNzYWdlIHx8IGVycn0pYCk7XG4gICAgcmV0dXJuIHBvcnRzO1xuICB9XG59XG5cbi8vIGRlYnVnKGBzdGFydCB3YXRjaGluZyB0aGUgZGV0ZWN0b3IgZmlsZSAke2RldGVjdGlvblBhdGh9YCk7XG4vLyBmcy53YXRjaEZpbGUoZGV0ZWN0aW9uUGF0aCwgeyBwZXJzaXN0ZW50OiBmYWxzZSB9LCAoY3VyciwgcHJldikgPT4ge1xuLy8gICBpZiAoY3Vyci5tdGltZSAhPT0gcHJldi5tdGltZSkge1xuLy8gICAgIGRlYnVnKGBkZXRlY3Rpb24gZmlsZSB3YXMgY2hhbmdlZCwgcmVsb2FkaW5nIGRldmljZXMuLi5gKTtcbi8vICAgICBkZXRlY3Rpb24gPSB1bmRlZmluZWQ7XG4vLyAgICAgcmVsb2FkRGV2aWNlcygpLmNhdGNoKCk7XG4vLyAgIH1cbi8vIH0pO1xuXG4vLyByZWxvYWREZXZpY2VzKCk7XG5cbmNvbnN0IHJlbG9hZCA9IF8uZGVib3VuY2UocmVsb2FkRGV2aWNlcywgMjAwMCk7XG5cbmV4cG9ydCBkZWZhdWx0IGRldGVjdG9yO1xuIl19