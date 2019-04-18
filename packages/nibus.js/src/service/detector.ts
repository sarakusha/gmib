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
import debugFactory from 'debug';
import { EventEmitter } from 'events';
import fs, { Stats } from 'fs';
import { PathReporter } from 'io-ts/lib/PathReporter';
import yaml from 'js-yaml';
import _ from 'lodash';
import path from 'path';
import SerialPort from 'serialport';
import UsbDetection from 'usb-detection';
import { IMibDescription } from '@nata/nibus.js-client/lib/MibDescription';
import {
  Category,
  CategoryV,
  HexOrNumber,
  IKnownPort,
  KnownPortV,
} from '@nata/nibus.js-client/lib/session/KnownPorts';

let usbDetection: typeof UsbDetection;
const debug = debugFactory('nibus:detector');
const detectionPath = path.resolve(__dirname, '../../detection.yml');
let knownPorts: Promise<IKnownPort[]> = Promise.resolve([]);

interface IDetectorItem {
  device: string;
  vid: HexOrNumber;
  pid: HexOrNumber;
  manufacturer?: string;
  serialNumber?: string;
  category: Category;
}

interface IDetection {
  mibCategories: {
    [category: string]: IMibDescription,
  };
  knownDevices: IDetectorItem[];
}

const loadDetection = (): IDetection | undefined => {
  try {
    const data = fs.readFileSync(detectionPath, 'utf8');
    const result = yaml.safeLoad(data) as IDetection;
    Object.keys(result.mibCategories).forEach((category) => {
      const desc = result.mibCategories[category];
      desc.category = category;
      if (Array.isArray(desc.select)) {
        desc.select = (desc.select as unknown as string[])
          .map(cat => result.mibCategories[cat] || cat);
      }
    });
    return result;
  } catch (err) {
    debug(`Error: failed to read file ${detectionPath} (${err.message})`);
    return undefined;
  }
};

let detection = loadDetection();

function reloadDevices(lastAdded?: UsbDetection.IDevice) {
  knownPorts = knownPorts.then(ports => reloadDevicesAsync(ports, lastAdded));
}

const detectionListener = (curr: Stats, prev: Stats) => {
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
class Detector extends EventEmitter {
  start() {
    usbDetection = require('usb-detection');
    usbDetection.startMonitoring();
    debug(`start watching the detector file ${detectionPath}`);
    fs.watchFile(detectionPath, { persistent: false }, detectionListener);
    // detection = loadDetection();
    reloadDevices();
    // Должна быть debounce с задержкой, иначе Serial.list не определит
    usbDetection.on('add', reload);
    // Удаление без задержки!
    usbDetection.on('remove', reloadDevices);
  }

  stop() {
    fs.unwatchFile(detectionPath, detectionListener);
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

  get detection(): IDetection | undefined {
    return detection;
  }
}

const detector = new Detector();

// interface ISerialPort {
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

const getId = (id?: HexOrNumber) => typeof id === 'string' ? parseInt(id, 16) : id;

function equals(port: SerialPort.PortInfo, device: UsbDetection.IDevice): boolean {
  return getId(port.productId) === device.productId
    && getId(port.vendorId) === device.vendorId
    && port.serialNumber === device.serialNumber;
}

async function detectDevice(port: SerialPort.PortInfo, lastAdded?: UsbDetection.IDevice)
  : Promise<IKnownPort> {
  let detected: UsbDetection.IDevice | undefined;
  if (lastAdded && equals(port, lastAdded)) {
    detected = lastAdded;
  } else {
    let list = await usbDetection.find(getId(port.vendorId)!, getId(port.productId)!, () => {});
    const { serialNumber, manufacturer } = port;
    list = _.filter(
      list,
      {
        serialNumber,
        manufacturer,
      },
    );
    if (list.length === 0) {
      debug(`Unknown device ${JSON.stringify(port)}`);
    } else if (list.length > 1) {
      debug(`can't identify device ${JSON.stringify(port)}`);
    } else {
      [detected] = list;
    }
  }
  if (detected !== undefined) {
    const { productId, vendorId, deviceName: device, deviceAddress } = detected;
    return {
      ...port,
      productId,
      vendorId,
      device,
      deviceAddress,
    };
  }
  return {
    ...port,
    productId: getId(port.productId)!,
    vendorId: getId(port.vendorId)!,
  };
}

// const loadDetection = () => new Promise<IDetection>((resolve, reject) => {
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

const matchCategory = (port: IKnownPort): Category => {
  const match = detection && _.find(
    detection!.knownDevices,
    item => (port.device && port.device.startsWith(item.device))
      && (!item.serialNumber
        || (port.serialNumber && port.serialNumber.startsWith(item.serialNumber)))
      && (!item.manufacturer || (port.manufacturer === item.manufacturer))
      && (getId(item.vid) === port.vendorId) && (getId(item.pid) === port.productId),
  ) as IDetectorItem;
  if (!match && process.platform === 'win32'
    && (port.productId === 0x6001 || port.productId === 0x6015)
    && port.vendorId === 0x0403) {
    return 'ftdi';
  }
  if (match) return CategoryV.decode(match.category).getOrElse(undefined);
};

async function reloadDevicesAsync(prevPorts: IKnownPort[], lastAdded?: UsbDetection.IDevice) {
  const ports: IKnownPort[] = [];
  try {
    if (detection == null) {
      detection = loadDetection();
    }
    const list: SerialPort.PortInfo[] = await SerialPort.list();
    const externalPorts = list.filter(port => !!port.productId);
    // const prevPorts = knownPorts.splice(0);

    await externalPorts.reduce(async (promise, port) => {
      const nextPorts = await promise;
      const prev = _.findIndex(prevPorts, { comName: port.comName });
      let device: IKnownPort;
      if (prev !== -1) {
        [device] = prevPorts.splice(prev, 1);
        const category = matchCategory(device);
        if (category !== device.category) {
          debug(`device's category was changed ${device.category} to ${category}`);
          device.category && detector.emit('remove', device);
          device.category = CategoryV.decode(category).getOrElse(undefined);
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
        // console.log('PORT', JSON.stringify(port));
        if (device.category) {
          debug(`new device ${device.device || device.vendorId}/\
${device.category} was plugged to ${device.comName}`);
          detector.emit('add', device);
        } else {
          debug('unknown device %o was plugged', device);
        }
      }
      const validation = KnownPortV.decode(device);
      if (validation.isLeft()) {
        debug('<error>', PathReporter.report(validation));
      } else {
        nextPorts.push(validation.value);
      }
      return nextPorts;
    }, Promise.resolve(ports));
    prevPorts.forEach((port) => {
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
}

// debug(`start watching the detector file ${detectionPath}`);
// fs.watchFile(detectionPath, { persistent: false }, (curr, prev) => {
//   if (curr.mtime !== prev.mtime) {
//     debug(`detection file was changed, reloading devices...`);
//     detection = undefined;
//     reloadDevices().catch();
//   }
// });

// reloadDevices();

const reload = _.debounce(reloadDevices, 2000);

export default detector;
