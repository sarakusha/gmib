import { ipcRenderer } from 'electron';

import type {
  Address,
  DeviceId,
  Display,
  Host,
  IDevice,
  INibusSession,
  Kind,
  VersionInfo,
} from '@nibus/core';
import {
  delay,
  Devices,
  // findDeviceById,
  findMibByType,
  getMibTypes as getMibTypesOrig,
  getNibusSession,
} from '@nibus/core';
import debugFactory from 'debug';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';

import { updateConfig } from '/@renderer/store/configSlice';
import { setCurrentHealth } from '/@renderer/store/currentSlice';
import { addLog } from '/@renderer/store/logSlice';
import type { DeviceProps, DeviceState } from '/@renderer/store/devicesSlice';
import {
  addDevice,
  changeAddress,
  deviceBusy,
  deviceReady,
  removeDevice,
  setConnected,
  updateProperty,
} from '/@renderer/store/devicesSlice';
import type { MibInfo, PropMetaInfo } from '/@renderer/store/mibsSlice';
import { addMib } from '/@renderer/store/mibsSlice';
import { addRemoteHost, getRemoteId, removeRemoteHost } from '/@renderer/store/remoteHostsSlice';
import { pushSensorValue } from '/@renderer/store/sensorsSlice';
import {
  releaseSession,
  setDisplays,
  setHostDescription,
  setOnline,
  setStatus,
} from '/@renderer/store/sessionSlice';
import type { Config } from '/@common/config';
import type {
  FinderOptions,
  Health,
  IModuleInfo,
  Minihost3Info,
  NibusTelemetry,
  RemoteHost,
  ValueState,
  ValueType,
} from '/@common/helpers';
import {
  assertNever,
  calcMaxValue,
  isPositiveNumber,
  Minihost3Selector,
  XMAX,
  YMAX,
} from '/@common/helpers';
import { host, isRemoteSession, port } from '/@common/remote';



import ipcDispatch from '../common/ipcDispatch';

import { validateConfig } from '/@common/schema';
import minihost3 from './minihost3.json';
import siolynx from './siolynx.json';

type DEMO = 'minihost3' | 'siolynx';

const devices = new Devices();

let minihost3Count = 0;

const randomHex = () => Math.floor(Math.random() * 256).toString(16);
declare module '@nibus/core' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface IDevice {
    setRawValue: (idOrName: number | string, value: unknown, isDirty?: boolean) => void;
  }
}

export type { Address };

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload`);
const RESTART_DELAY = 3000;

let isConnected = false;

const session = getNibusSession(port, host);

session.on('log', line => {
  ipcDispatch(addLog(line));
});

type PropEntity = [name: string, state: ValueState];

const getDeviceProp =
  (device: IDevice) =>
  (idOrName: string | number): PropEntity => {
    const error = device.getError(idOrName);
    const name = device.getName(idOrName);
    return [
      name,
      {
        // eslint-disable-next-line no-nested-ternary
        status: error ? 'failed' : device.isDirty(idOrName) ? 'pending' : 'succeeded',
        value: device[name],
        error: error?.message,
        raw: device.getRawValue(idOrName),
      },
    ];
  };

const getProps = (device: IDevice, idsOrNames?: (number | string)[]): DeviceProps => {
  const proto = Reflect.getPrototypeOf(device) ?? {};
  const names =
    idsOrNames ??
    ((Reflect.getMetadata('mibProperties', proto) as string[]).filter(name =>
      Reflect.getMetadata('isReadable', proto, name),
    ) as (string | number)[]);
  const getProp = getDeviceProp(device);
  return Object.fromEntries<ValueState>(names.map(getProp));
};

export { findMibByType };

export const setLogLevel = session.setLogLevel.bind(session);

type Version = Omit<VersionInfo, 'connection'> & {
  owner?: string;
};

export const setDeviceValue = (
  deviceId: DeviceId,
): ((name: string, value: ValueType) => Promise<void>) => {
  const device = devices.findById(deviceId);
  if (!device) {
    debug(`Unknown device ${deviceId}`);
    return () => Promise.reject(new Error('Unknown device val'));
  }
  const getProp = getDeviceProp(device);
  const proto = Reflect.getPrototypeOf(device);
  const propNames = (
    (proto && (Reflect.getMetadata('mibProperties', proto) as string[])) ??
    []
  ).filter(name => proto && Reflect.getMetadata('isWritable', proto, name));

  return async (name, value) => {
    if (!propNames.includes(name)) {
      debug(`Unknown property ${name}`);
      return;
    }
    device[name] = value;
    ipcDispatch(updateProperty([deviceId, ...getProp(name)]));
  };
};


export const sendConfig = debounce((state: Record<string, unknown>): void => {
  const { loading, ...config } = state;
  if (!validateConfig(config)) debug('error while validate config');
  session.saveConfig({ ...config });
}, 500);

let sensorTimer = 0;

const random = (max = 1, min = 0): number => Math.random() * (max - min) + min;

const createFakeDevice = (mib: DEMO) => {
  const b1 = randomHex();
  const b2 = randomHex();
  const address = `::${b1}:${b2}`;
  const mac = [b1, b2].join('').padStart(8 * 2, '0');
  const device = devices.create(address, mib);
  if (!device) return;
  const load = (data: object) =>
    Object.entries(data).forEach(([name, raw]) => device.setRawValue(name, raw, false));
  switch (mib) {
    case 'minihost3':
      load(minihost3);
      device.setRawValue('serno', mac);
      // eslint-disable-next-line no-plusplus
      device.setRawValue('did', ++minihost3Count);
      break;
    case 'siolynx':
      load(siolynx);
      if (!sensorTimer) {
        sensorTimer = window.setInterval(
          () =>
            ipcDispatch(
              pushSensorValue({
                kind: 'illuminance',
                value: Math.round(random(1500, 30000)),
                address: '0.0.1',
              }),
            ),
          5000,
        );
      }
      break;
    default:
      assertNever(mib);
  }
};

ipcRenderer.on('createFakeDevice', (e, mib: DEMO) => {
  console.log(mib);
  createFakeDevice(mib);
});

const newDeviceHandler = async (device: IDevice): Promise<void> => {
  const { id: deviceId, address, connection } = device;
  const connectedHandler = (): void => {
    ipcDispatch(setConnected([deviceId, !!device.connection]));
  };
  const disconnectedHandler = (): void => {
    device.release();
  };
  const addressHandler = (prev: Address, value: Address): void => {
    ipcDispatch(changeAddress([deviceId, value.toString()]));
  };
  const releaseHandler = (): void => {
    device.off('connected', connectedHandler);
    device.off('disconnected', disconnectedHandler);
    device.off('release', releaseHandler);
    device.off('addressChanged', addressHandler);
  };
  device.on('connected', connectedHandler);
  device.on('disconnected', disconnectedHandler);
  device.on('release', releaseHandler);
  device.on('addressChanged', addressHandler);

  const mib = Reflect.getMetadata('mib', device);
  const proto = Reflect.getPrototypeOf(device) ?? {};
  const mibProperties = (Reflect.getMetadata('mibProperties', proto) ?? []) as string[];
  const properties = Object.fromEntries(
    mibProperties.map<[string, PropMetaInfo]>(name => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getPropMeta = (key: string): any => Reflect.getMetadata(key, proto, name);
      return [
        name,
        {
          id: device.getId(name),
          displayName: getPropMeta('displayName'),
          isReadable: getPropMeta('isReadable'),
          isWritable: getPropMeta('isWritable'),
          type: getPropMeta('type'),
          simpleType: getPropMeta('simpleType'),
          category: getPropMeta('category'),
          rank: getPropMeta('rank'),
          unit: getPropMeta('unit'),
          min: getPropMeta('min'),
          max: getPropMeta('max'),
          step: getPropMeta('step'),
          enumeration: getPropMeta('enum'),
          convertFrom: getPropMeta('convertFrom'),
        } as PropMetaInfo,
      ];
    }),
  );
  const mibInfo: MibInfo = {
    name: mib,
    properties,
    disableBatchReading: Reflect.getMetadata('disableBatchReading', proto),
  };
  ipcDispatch(addMib(mibInfo));
  const entity: DeviceState = {
    id: deviceId,
    address: address.toString(),
    connected: true,
    path: connection?.path,
    mib: Reflect.getMetadata('mib', device),
    isEmptyAddress: address.isEmpty,
    props: getProps(device),
    isBusy: 0,
  };

  ipcDispatch(addDevice(entity));
};

const deleteDeviceHandler = (device: IDevice): void => {
  try {
    ipcDispatch(removeDevice(device.id));
  } catch (e) {
    console.error(e);
  }
};

devices.on('new', newDeviceHandler);
devices.on('delete', deleteDeviceHandler);

export function createDevice(parent: DeviceId, address: string, mib: string): void;
export function createDevice(
  parent: DeviceId,
  address: string,
  type: number,
  version?: number,
): void;
export function createDevice(
  parent: DeviceId,
  address: string,
  typeOrMib: string | number,
  version?: number,
): void {}

export const reloadDevices: INibusSession['reloadDevices'] = () => {};
export const ping = async (address: string): Promise<[-1, undefined] | [number, Version]> => [
  -1,
  undefined,
];

export const reloadDevice = async (deviceId: DeviceId): Promise<void> => {};

export const releaseDevice = (deviceId: DeviceId): void => {};

function openSession() {
  // const addConnectionHandler = (): void => {
  //   ipcDispatch(setPortCount(session.ports));
  // };
  // const removeConnectionHandler = (connection: INibusConnection): void => {
  //   ipcDispatch(setPortCount(session.ports));
  //   ipcDispatch(connectionClosed(connection.path));
  // };
  // const foundHandler: FoundListener = async ({ address, connection }) => {
  //   try {
  //     if (connection.description.mib) {
  //       session.devices.create(address, connection.description.mib, connection);
  //     } else {
  //       const { version, type } = (await connection.getVersion(address)) ?? {};
  //       type != null && session.devices.create(address, type, version, connection);
  //     }
  //   } catch (e) {
  //     debug('error in found handler', e);
  //   }
  // };
  // const pureConnectionHandler = (connection: INibusConnection): void => {
  //   ipcDispatch(
  //     addDevice({
  //       id: nanoid() as DeviceId,
  //       address: '',
  //       mib: '',
  //       connected: true,
  //       path: connection.path,
  //       isEmptyAddress: true,
  //       props: {},
  //       category: 'c22',
  //       isLinkingDevice: true,
  //       isBusy: 0,
  //     }),
  //   );
  // };
  // const newDeviceHandler = async (device: IDevice): Promise<void> => {
  //   const { id: deviceId, address, connection } = device;
  //   const connectedHandler = (): void => {
  //     ipcDispatch(setConnected([deviceId, !!device.connection]));
  //   };
  //   const disconnectedHandler = (): void => {
  //     device.release();
  //   };
  //   const addressHandler = (prev: Address, value: Address): void => {
  //     ipcDispatch(changeAddress([deviceId, value.toString()]));
  //   };
  //   const releaseHandler = (): void => {
  //     device.off('connected', connectedHandler);
  //     device.off('disconnected', disconnectedHandler);
  //     device.off('release', releaseHandler);
  //     device.off('addressChanged', addressHandler);
  //   };
  //   device.on('connected', connectedHandler);
  //   device.on('disconnected', disconnectedHandler);
  //   device.on('release', releaseHandler);
  //   device.on('addressChanged', addressHandler);

  //   const mib = Reflect.getMetadata('mib', device);
  //   const proto = Reflect.getPrototypeOf(device) ?? {};
  //   const mibProperties = (Reflect.getMetadata('mibProperties', proto) ?? []) as string[];
  //   const properties = Object.fromEntries(
  //     mibProperties.map<[string, PropMetaInfo]>(name => {
  //       // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //       const getPropMeta = (key: string): any => Reflect.getMetadata(key, proto, name);
  //       return [
  //         name,
  //         {
  //           id: device.getId(name),
  //           displayName: getPropMeta('displayName'),
  //           isReadable: getPropMeta('isReadable'),
  //           isWritable: getPropMeta('isWritable'),
  //           type: getPropMeta('type'),
  //           simpleType: getPropMeta('simpleType'),
  //           category: getPropMeta('category'),
  //           rank: getPropMeta('rank'),
  //           unit: getPropMeta('unit'),
  //           min: getPropMeta('min'),
  //           max: getPropMeta('max'),
  //           step: getPropMeta('step'),
  //           enumeration: getPropMeta('enum'),
  //           convertFrom: getPropMeta('convertFrom'),
  //         } as PropMetaInfo,
  //       ];
  //     }),
  //   );
  //   const mibInfo: MibInfo = {
  //     name: mib,
  //     properties,
  //     disableBatchReading: Reflect.getMetadata('disableBatchReading', proto),
  //   };
  //   ipcDispatch(addMib(mibInfo));
  //   const entity: DeviceState = {
  //     id: deviceId,
  //     address: address.toString(),
  //     connected: true,
  //     path: connection?.path,
  //     mib: Reflect.getMetadata('mib', device),
  //     isEmptyAddress: address.isEmpty,
  //     props: getProps(device),
  //     isBusy: 0,
  //   };

    // if (connection?.owner === device) {
    //   entity.isLinkingDevice = connection.description.link;
    //   entity.category = connection.description.category;
    //   if (entity.isLinkingDevice) {
    //     const idleHandler = () => {
    //       const [older] = sortBy(getChildren(device), 'lastActivity');
    //       if (older) older.ping();
    //     };
    //     connection.on('idle', idleHandler);
    //     connection.once('close', () => {
    //       connection.off('idle', idleHandler);
    //     });
    //   }
    // }
  //   ipcDispatch(addDevice(entity));
  // };

  // const deleteDeviceHandler = (device: IDevice): void => {
  //   try {
  //     ipcDispatch(removeDevice(device.id));
  //   } catch (e) {
  //     debug(toErrorMessage(e));
  //   }
  // };

  const configHandler = (config: Record<string, unknown>): void => {
    // const data = convertCfgFrom(config);
    const data = config as Config;
    if (!validateConfig(data)) debug('Invalid configuration data received');
    ipcDispatch(updateConfig(data));
  };

  const healthHandler = (health: Record<string, unknown>): void => {
    // debug(`health ${JSON.stringify(health)}`);
    ipcDispatch(setCurrentHealth(health as Health));
  };

  const hostHandler = (hostArgs: Host): void => {
    ipcDispatch(setHostDescription(hostArgs));
  };

  const onlineHandler = (online: boolean): void => {
    ipcDispatch(setOnline(online));
  };

  const displaysHandler = (displays: Display[]): void => {
    ipcDispatch(setDisplays(displays));
  };

  // TODO: REMOTE
  // const addForeignDeviceHandler = async ({
  //   portInfo: { path },
  //   description,
  // }: PortArg): Promise<void> => {
  //   if (description.category !== 'novastar') return;
  //   fetch(`http://${host}:${port + 1}/api/novastar/serial`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       authorization: `Bearer ${getSecret()}`,
  //     },
  //     body: JSON.stringify({ path, port }),
  //   });
  // };

  // const sensorsState = new Map<string, Omit<SensorsData, 'address'>>();

  // const saveImpl = memoize((address: string) =>
  //   debounce(() => {
  //     const data = sensorsState.get(address);
  //     if (data) {
  //       ipcRenderer.send('sensors', { address, ...data } as SensorsData);
  //       sensorsState.delete(address);
  //     }
  //   }, 1000),
  // );

  // const saveSensor = ({ address, ...props }: SensorsData) => {
  //   const state = sensorsState.get(address) ?? {};
  //   sensorsState.set(address, { ...state, ...props });
  //   saveImpl(address)();
  // };

  // const informationListener: NibusSessionEvents['informationReport'] = (
  //   connection,
  //   { id, value, source },
  // ) => {
  //   const address = source.toString();
  //   switch (id) {
  //     case ILLUMINATION:
  //       ipcDispatch(
  //         pushSensorValue({
  //           kind: 'illuminance',
  //           address,
  //           value,
  //         }),
  //       );
  //       if (!isRemoteSession) saveSensor({ address, illuminance: value });
  //       break;
  //     case TEMPERATURE:
  //       ipcDispatch(
  //         pushSensorValue({
  //           kind: 'temperature',
  //           address,
  //           value,
  //         }),
  //       );
  //       if (!isRemoteSession) saveSensor({ address, temperature: value });
  //       break;
  //     default:
  //       break;
  //   }
  // };

  session.on('displays', displaysHandler);
  session.on('online', onlineHandler);
  // session.on('add', addConnectionHandler);
  // session.on('remove', removeConnectionHandler);
  // session.on('found', foundHandler);
  // session.on('pureConnection', pureConnectionHandler);
  // session.on('logLevel', logLevelHandler);
  session.on('config', configHandler);
  session.once('host', hostHandler);
  // session.on('informationReport', informationListener);
  // if (!isRemoteSession) {
  //   session.on('foreign', addForeignDeviceHandler);
  // }
  session.on('health', healthHandler);
  // session.devices.on('new', newDeviceHandler);
  // session.devices.on('delete', deleteDeviceHandler);
  const release = (): void => {
    session.off('displays', displaysHandler);
    session.off('online', onlineHandler);
    // session.off('add', addConnectionHandler);
    // session.off('remove', removeConnectionHandler);
    // session.off('found', foundHandler);
    // session.off('pureConnection', pureConnectionHandler);
    session.off('config', configHandler);
    session.off('host', hostHandler);
    // session.off('informationReport', informationListener);
    // session.off('foreign', addForeignDeviceHandler);
    session.off('health', healthHandler);
    // session.devices.off('new', newDeviceHandler);
    // session.devices.off('delete', deleteDeviceHandler);
    ipcDispatch(releaseSession());
  };
  session.once('close', release);
  ipcDispatch(
    setStatus({
      status: 'pending',
      error: undefined,
      portCount: 0,
    }),
  );
  const start = (): void => {
    if (isConnected) return;
    session
      .start()
      .then(ports => {
        isConnected = true;
        ipcDispatch(
          setStatus({
            status: 'succeeded',
            portCount: ports,
            error: undefined,
          }),
        );
      })
      .catch(e => {
        if (isRemoteSession) {
          ipcRenderer.send('startLocalNibus');
        } else {
          debug(`error while start session: ${e.message}`);
        }
        ipcDispatch(
          setStatus({
            status: 'failed',
            portCount: 0,
            error: e.message,
          }),
        );
        setTimeout(start, RESTART_DELAY);
      });
  };
  start();
  window.addEventListener('beforeunload', () => {
    session.close();
  });
}

window.onload = openSession;

export const writeToStorage = async (deviceId: DeviceId): Promise<boolean> => true;

// const finder = new Finder();

// finder.on('start', () => {
//   ipcDispatch(resetDetected());
//   ipcDispatch(setSearching(true));
// });

// finder.on('finish', () => {
//   ipcDispatch(setSearching(false));
// });

// finder.on('found', info => {
//   ipcDispatch(addDetected(info));
// });

export const findDevices = async (options: FinderOptions) => {};

export const cancelSearch = async () => {};

ipcRenderer.on('serviceUp', (event, remoteHost: RemoteHost) => {
  // debug('serviceUp');
  ipcDispatch(addRemoteHost(remoteHost));
});

ipcRenderer.on('serviceDown', (event, remoteHost: RemoteHost) => {
  // debug('serviceDown');
  ipcDispatch(removeRemoteHost(getRemoteId(remoteHost)));
});

ipcRenderer.on('reloadDevices', reloadDevices);

const fakeReadColumn = (selectors: number[]): Minihost3Info => {
  const info: Minihost3Info = {};
  if (selectors.includes(Minihost3Selector.Temperature)) {
    info.t = Math.round(random(60, 50));
  }
  if (selectors.includes(Minihost3Selector.Version)) {
    info.PLD = '6.8';
    info.MCU = '2.11';
  }
  if (selectors.includes(Minihost3Selector.Voltage1)) {
    info.v1 = Math.round(random(3800, 3600));
  }
  if (selectors.includes(Minihost3Selector.Voltage2)) {
    info.v2 = Math.round(random(5800, 5600));
  }
  return info;
};

let cancelled = false;

export const telemetry = (id: DeviceId): NibusTelemetry => ({
  start: async (options, cb) => {
    const device = devices.findById(id);
    if (!device) return [];
    const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = device;
    const {
      xMin = 0,
      xMax = calcMaxValue(
        hres,
        moduleHres,
        isPositiveNumber(maxModulesH) ? maxModulesH.value : XMAX,
      ) - 1,
      yMin = 0,
      yMax = calcMaxValue(
        vres,
        moduleVres,
        isPositiveNumber(maxModulesV) ? maxModulesV.value : YMAX,
      ) - 1,
      selectors = [],
    } = options;

    ipcDispatch(deviceBusy(id));
    cb?.([]);
    const modules: IModuleInfo<Minihost3Info>[] = [];
    cancelled = false;
    for (let x = xMin; x <= xMax && !cancelled; x += 1) {
      for (let y = yMin; y <= yMax && !cancelled; y += 1) {
        const module: IModuleInfo<Minihost3Info> = {
          x,
          y,
          info: fakeReadColumn(selectors),
        };
        // eslint-disable-next-line no-await-in-loop
        await delay(1);
        cb?.(prev => [...prev, module]);
        modules.push(module);
      }
    }
    ipcDispatch(deviceReady(id));
    return modules;
  },
  cancel: async () => {
    cancelled = true;
  },
});

export const getBrightnessHistory: INibusSession['getBrightnessHistory'] = async () => [];

type EntryType<T> = T extends Record<infer N, infer V> ? [N, V] : never;

const entries = <T extends Record<string, unknown>>(obj: T): EntryType<T>[] =>
  Object.entries(obj) as EntryType<T>[];

export const mibTypes = sortBy(
  entries(getMibTypesOrig())
    .map(([type, mibs]) => ({ value: type, name: mibs.map(({ mib }) => mib).join(', ') }))
    .filter(({ value }) => value !== '0'),
  ['name'],
);

const OFFSET_SUCCESS = 0x1800;

function* generateSuccessKey(maxSuccess = 3): Generator<number, number> {
  let id = 0;
  while (true) {
    yield id + OFFSET_SUCCESS;
    id = (id + 1) % maxSuccess;
  }
}

export const flash = async (
  id: DeviceId,
  kind: Kind | false,
  filename: string | undefined,
  moduleSelect?: number,
): Promise<void> => {};
