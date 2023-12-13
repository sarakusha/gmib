import type { Address, DeviceId, IDevice, INibusSession, Kind, VersionInfo } from '@nibus/core';
import { Devices, findMibByType, getMibTypes as getMibTypesOrig } from '@nibus/core';
import type { FinderOptions, NibusTelemetry, ValueState, ValueType } from '/@common/helpers';
import sortBy from 'lodash/sortBy';
import { ipcRenderer } from 'electron';
import debugFactory from 'debug';
import type { DeviceProps, DeviceState, PropTuple } from '/@renderer/store/devicesSlice';
import {
  addDevice,
  changeAddress,
  connectionClosed,
  deviceBusy,
  deviceReady,
  removeDevice,
  setConnected,
  setParent,
  updateProperty,
  updateProps,
} from '/@renderer/store/devicesSlice';
import type { MibInfo, PropMetaInfo } from '/@renderer/store/mibsSlice';
import { addMib } from '/@renderer/store/mibsSlice';
import { addRemoteHost, getRemoteId, removeRemoteHost } from '/@renderer/store/remoteHostsSlice';
import { ILLUMINATION, pushSensorValue, TEMPERATURE } from '/@renderer/store/sensorsSlice';
import {
  addDetected,
  releaseSession,
  resetDetected,
  setDisplays,
  setHostDescription,
  setOnline,
  setPortCount,
  setSearching,
  setStatus,
} from '/@renderer/store/sessionSlice';

import ipcDispatch from '../common/ipcDispatch';
import { updateConfig } from '/@renderer/store/configSlice';
import { DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import { assertNever } from '/@common/helpers';

import minihost3 from './minihost3.json';
import siolynx from './siolynx.json';

type DEMO = 'minihost3' | 'siolynx';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload`);

type Version = Omit<VersionInfo, 'connection'> & {
  owner?: string;
};

const devices = new Devices();

let minihost3Count = 0;

const randomHex = () => Math.floor(Math.random() * 256).toString(16);

const randomMAC = () => `::${[0, 1].map(() => randomHex()).join(':')}`;
//   "serno": "0000000000007882",

type PropEntity = [name: string, state: ValueState];

declare module '@nibus/core' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface IDevice {
    setRawValue: (idOrName: number | string, value: unknown, isDirty?: boolean) => void;
  }
}

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
  ).filter(name => proto);

  return async (name, value) => {
    console.log(`set ${name}=${value}`);
    if (!propNames.includes(name)) {
      debug(`Unknown property ${name}`);
      return;
    }
    device[name] = value;
    ipcDispatch(updateProperty([deviceId, ...getProp(name)]));
  };
};

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
      break;
    default:
      assertNever(mib);
  }
};

ipcRenderer.on('createFakeDevice', (e, mib: DEMO) => {
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

export { findMibByType };

export const reloadDevices: INibusSession['reloadDevices'] = () => {};
export const setLogLevel: INibusSession['setLogLevel'] = () => {};
export const ping = async (address: string): Promise<[-1, undefined] | [number, Version]> => [
  -1,
  undefined,
];
export const sendConfig = (state: Record<string, unknown>): void => {};

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

export const reloadDevice = async (deviceId: DeviceId): Promise<void> => {};

export const releaseDevice = (deviceId: DeviceId): void => {};

export const writeToStorage = async (deviceId: DeviceId): Promise<boolean> => false;

export const findDevices = async (options: FinderOptions) => {};

export const cancelSearch = async () => {};

export const telemetry = (id: DeviceId): NibusTelemetry => ({
  start: async () => [],
  cancel: async () => {},
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

export const flash = async (
  id: DeviceId,
  kind: Kind | false,
  filename: string | undefined,
  moduleSelect?: number,
): Promise<void> => {};

setTimeout(() => {
  ipcDispatch(setOnline(true));
  ipcDispatch(
    updateConfig({
      autobrightness: true,
      brightness: 80,
      overheatProtection: DEFAULT_OVERHEAD_PROTECTION,
      logLevel: 'none',
    }),
  );
}, 3000);
