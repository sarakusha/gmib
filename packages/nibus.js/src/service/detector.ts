import _ from 'lodash';
import debugFactory from 'debug';
import fs from 'fs';
import path from 'path';
import SerialPort from 'serialport';
import usbDetection from 'usb-detection';
import yaml from 'js-yaml';
import { EventEmitter } from 'events';
import { NibusBaudRate } from '../nibus';

const debug = debugFactory('nibus:detector');
const detectionPath = path.resolve(__dirname, './detection.yml');
const knownPorts: IKnownPort[] = [];

const loadDetection = (): IDetection | undefined => {
  try {
    const data = fs.readFileSync(detectionPath, 'utf8');
    const result = yaml.safeLoad(data) as IDetection;
    Object.keys(result.mibCategories).forEach((category) => {
      result.mibCategories[category].category = category;
    });
    return result;
  } catch (err) {
    debug(`Error: failed to read file ${detectionPath} (${err.message})`);
    return undefined;
  }
};

let detection = loadDetection();

class Detector extends EventEmitter {
  start() {
    usbDetection.startMonitoring();
  }

  stop() {
    usbDetection.stopMonitoring();
  }

  restart() {
    usbDetection.stopMonitoring();
    process.nextTick(() => usbDetection.startMonitoring());
  }

  get ports() {
    return knownPorts;
  }

  get detection() {
    return detection;
  }
}

const detector = new Detector();

interface ISerialPort {
  comName: string;
  locationId: string;
  manufacturer: string;
  pnpId?: string;
  productId: HexOrNumber;
  serialNumber: string;
  vendorId: HexOrNumber;
}

export interface IKnownPort extends ISerialPort {
  device?: string;
  productId: number;
  vendorId: number;
  category?: string;
}

type HexOrNumber = string | number;

type Category = 'siolynx' | 'minihost' | 'fancontrol' | 'c22' | 'relay';

interface IDetectorItem {
  device: string;
  vid: HexOrNumber;
  pid: HexOrNumber;
  manufacturer?: string;
  serialNumber?: string;
  category: Category;
}

export interface IMibDescription {
  mib?: string;
  link?: boolean;
  baudRate?: NibusBaudRate;
  category: string;
}

interface IDetection {
  mibCategories: {
    [category: string]: IMibDescription,
  };
  knownDevices: IDetectorItem[];
}

const getId = (id: HexOrNumber) => typeof id === 'string' ? parseInt(id, 16) : id;

function equals(port: ISerialPort, device: usbDetection.IDevice): boolean {
  return (getId(port.productId) === device.productId)
    && (getId(port.vendorId) === device.vendorId)
    && port.serialNumber === device.serialNumber;
}

async function detectDevice(port: ISerialPort, lastAdded?: usbDetection.IDevice)
  : Promise<IKnownPort> {
  let detected: usbDetection.IDevice | undefined;
  if (lastAdded && equals(port, lastAdded)) {
    detected = lastAdded;
  } else {
    let list = await usbDetection.find(getId(port.vendorId), getId(port.productId), () => {});
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
    const { productId, vendorId, deviceName: device } = detected;
    return {
      ...port,
      productId,
      vendorId,
      device,
    };
  }
  return {
    ...port,
    productId: getId(port.productId),
    vendorId: getId(port.vendorId),
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

const matchCategory = (port: IKnownPort): string | undefined => {
  const match = detection && _.find(
    detection!.knownDevices,
    item => (port.device && port.device.startsWith(item.device))
      && (!item.serialNumber
        || (port.serialNumber && port.serialNumber.startsWith(item.serialNumber)))
      && (!item.manufacturer || (port.manufacturer === item.manufacturer))
      && (getId(item.vid) === port.vendorId) && (getId(item.pid) === port.productId),
  ) as IDetectorItem;
  if (match) return match.category;
};

async function reloadDevices(lastAdded?: usbDetection.IDevice) {
  try {
    if (detection == null) {
      detection = loadDetection();
    }
    const list: ISerialPort[] = await SerialPort.list();
    const externalPorts = list.filter(port => !!port.productId);
    const prevPorts = knownPorts.splice(0);

    await externalPorts.reduce(async (promise, port) => {
      await promise;
      const prev = _.findIndex(prevPorts, { comName: port.comName });
      let device: IKnownPort;
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
        detector.emit('plug', device);
        debug(`new device ${device.device || device.vendorId}/\
${device.category || device.productId} was plugged to ${device.comName}`);
        if (device.category) {
          detector.emit('add', device);
        }
      }
      knownPorts.push(device);
    }, Promise.resolve());
    prevPorts.forEach((port) => {
      detector.emit('unplug', port);
      debug(`device ${port.device || port.vendorId}/\
${port.category || port.productId} was unplugged from ${port.comName}`);
      port.category && detector.emit('remove', port);
    });
  } catch (err) {
    debug(`Error: reload devices was failed (${err.message || err})`);
  }
}

debug(`start watching the detector file ${detectionPath}`);
fs.watchFile(detectionPath, { persistent: false }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    debug(`detection file was changed, reloading devices...`);
    detection = undefined;
    reloadDevices().catch();
  }
});

reloadDevices().catch();

const reload = _.debounce(reloadDevices, 2000);
usbDetection.on('add', (usbDevice) => {
  debug('added', JSON.stringify(usbDevice));
  reload(usbDevice);
});

usbDetection.on('remove', (usbDevice) => {
  debug('removed', JSON.stringify(usbDevice));
  reloadDevices(usbDevice).catch();
});

export default detector;
