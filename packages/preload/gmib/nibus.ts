import { ipcRenderer } from 'electron';

import type {
  Address,
  DeviceId,
  Display,
  FoundListener,
  Host,
  IDevice,
  INibusConnection,
  Kind,
  NibusSessionEvents,
  PortArg,
  VersionInfo,
} from '@nibus/core';
import {
  findDeviceById,
  findMibByType,
  Flasher,
  getMibTypes as getMibTypesOrig,
  getNibusSession,
} from '@nibus/core';
import { nanoid } from 'nanoid';
import debugFactory from 'debug';
import debounce from 'lodash/debounce';
import memoize from 'lodash/memoize';
import sortBy from 'lodash/sortBy';

import { updateConfig } from '/@renderer/store/configSlice';
import { setCurrentHealth } from '/@renderer/store/currentSlice';
import { addLog } from '/@renderer/store/logSlice';
import type { DeviceProps, DeviceState } from '/@renderer/store/devicesSlice';
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
import type { Config } from '/@common/config';
import type {
  Health,
  Modules,
  NibusTelemetry,
  RemoteHost,
  SensorsData,
  TelemetryOpts,
  ValueState,
  ValueType,
} from '/@common/helpers';
import { toErrorMessage } from '/@common/helpers';
import { host, isRemoteSession, port } from '/@common/remote';

import { getSecret } from '../common/identify';

import Finder from './Finder';
import Minihost2Loader from './Minihost2Loader';
import Minihost3Loader from './Minihost3Loader';

import ipcDispatch from '../common/ipcDispatch';

import { validateConfig } from '/@common/schema';
import { enqueueSnackbar, setFlashing, setProgress } from '/@renderer/store/flasherSlice';
import type { GmibWindowParams } from '/@common/WindowParams';

export type { Address };

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload`);
const RESTART_DELAY = 3000;

let isConnected = false;

const session = getNibusSession(port, host);

session.on('log', line => {
  ipcDispatch(addLog(line));
});

const addForeign = new Promise<boolean>(resolve => {
  ipcRenderer.once('gmib-params', (_, params: GmibWindowParams) => {
    resolve(Boolean(params.useProxy));
  });
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

export const reloadDevices = session.reloadDevices.bind(session);

export const setLogLevel = session.setLogLevel.bind(session);

type Version = Omit<VersionInfo, 'connection'> & {
  owner?: string;
};

export const ping = async (address: string): Promise<[-1, undefined] | [number, Version]> => {
  const [timeout, version] = await session.ping(address);
  if (version === undefined) return [timeout, undefined];
  const { connection, ...props } = version;
  return [timeout, { ...props, owner: connection.owner?.id }];
};

export const setDeviceValue = (
  deviceId: DeviceId,
): ((name: string, value: ValueType) => Promise<void>) => {
  const device = findDeviceById(deviceId);
  if (!device) {
    debug(`Unknown device ${deviceId}`);
    return () => Promise.reject(new Error('Unknown device val'));
  }
  const drainDevice = debounce(async (): Promise<void> => {
    const ids = await device.drain();
    // console.log(`drain: ${ids.join(', ')}`);
    if (ids.length === 0) return;
    const failed = ids.filter(ident => ident < 0).map(ident => -ident);
    failed.length > 0 && (await device.read(...failed));
    ipcDispatch(updateProps([deviceId, getProps(device, ids.map(Math.abs))]));
  }, 400);
  const getProp = getDeviceProp(device);
  const proto = Reflect.getPrototypeOf(device);
  const propNames = (
    (proto && (Reflect.getMetadata('mibProperties', proto) as string[])) ??
    []
  ).filter(name => proto && Reflect.getMetadata('isWritable', proto, name));

  return async (name, value) => {
    // console.log(`set ${name}=${value}`);
    if (!propNames.includes(name)) {
      debug(`Unknown property ${name}`);
      return;
    }
    device[name] = value;
    ipcDispatch(updateProperty([deviceId, ...getProp(name)]));
    drainDevice();
  };
};

export const sendConfig = debounce((state: Record<string, unknown>): void => {
  const { loading, ...config } = state;
  if (!validateConfig(config)) debug('error while validate config');
  session.saveConfig({ ...config });
}, 500);

const getChildren = (parent: IDevice): IDevice[] =>
  session.devices.get().filter(device => device.connection?.owner === parent && device !== parent);

export const createDevice = (
  parent: DeviceId,
  address: string,
  type: number,
  version?: number,
): void => {
  const device = session.devices.create(address, type, version);
  const parentDevice = session.devices.findById(parent);
  if (parentDevice) {
    device.connection = parentDevice.connection;
  }
  setTimeout(() => ipcDispatch(setParent([device.id, parent])), 0);
};

export const reloadDevice = async (deviceId: DeviceId): Promise<void> => {
  const device = findDeviceById(deviceId);
  if (!device) {
    ipcDispatch(removeDevice(deviceId));
    return;
  }
  if (!device.connection) return;
  ipcDispatch(deviceBusy(deviceId));
  await device.read();
  ipcDispatch(updateProps([deviceId, getProps(device)]));
  ipcDispatch(deviceReady(deviceId));
};

export const releaseDevice = (deviceId: DeviceId): void => {
  const device = findDeviceById(deviceId);
  if (!device) {
    ipcDispatch(removeDevice(deviceId));
    return;
  }
  device.release();
};

function openSession() {
  const addConnectionHandler = (): void => {
    ipcDispatch(setPortCount(session.ports));
  };
  const removeConnectionHandler = (connection: INibusConnection): void => {
    ipcDispatch(setPortCount(session.ports));
    ipcDispatch(connectionClosed(connection.path));
  };
  const foundHandler: FoundListener = async ({ address, connection }) => {
    try {
      if (connection.description.mib) {
        session.devices.create(address, connection.description.mib, connection);
      } else {
        const { version, type } = (await connection.getVersion(address)) ?? {};
        type != null && session.devices.create(address, type, version, connection);
      }
    } catch (e) {
      debug('error in found handler', e);
    }
  };
  const pureConnectionHandler = (connection: INibusConnection): void => {
    ipcDispatch(
      addDevice({
        id: nanoid() as DeviceId,
        address: '',
        mib: '',
        connected: true,
        path: connection.path,
        isEmptyAddress: true,
        props: {},
        category: 'c22',
        isLinkingDevice: true,
        isBusy: 0,
      }),
    );
  };
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
      connected: !!connection,
      path: connection?.path,
      mib: Reflect.getMetadata('mib', device),
      isEmptyAddress: address.isEmpty,
      props: getProps(device),
      isBusy: 0,
    };
    if (connection?.owner === device) {
      entity.isLinkingDevice = connection.description.link;
      entity.category = connection.description.category;
      if (entity.isLinkingDevice) {
        const idleHandler = () => {
          const [older] = sortBy(getChildren(device), 'lastActivity');
          if (older) older.ping();
        };
        connection.on('idle', idleHandler);
        connection.once('close', () => {
          connection.off('idle', idleHandler);
        });
      }
    }
    ipcDispatch(addDevice(entity));
    await reloadDevice(deviceId);
  };
  const deleteDeviceHandler = (device: IDevice): void => {
    try {
      ipcDispatch(removeDevice(device.id));
    } catch (e) {
      debug(toErrorMessage(e));
    }
  };

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
  const addForeignDeviceHandler = async ({
    portInfo: { path },
    description,
  }: PortArg): Promise<void> => {
    if (description.category !== 'novastar') return;
    fetch(`http://${host}:${port + 1}/api/novastar/serial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${getSecret()}`,
      },
      body: JSON.stringify({ path, port }),
    });
  };

  const sensorsState = new Map<string, Omit<SensorsData, 'address'>>();

  const saveImpl = memoize((address: string) =>
    debounce(() => {
      const data = sensorsState.get(address);
      if (data) {
        ipcRenderer.send('sensors', { address, ...data } as SensorsData);
        sensorsState.delete(address);
      }
    }, 1000),
  );

  const saveSensor = ({ address, ...props }: SensorsData) => {
    const state = sensorsState.get(address) ?? {};
    sensorsState.set(address, { ...state, ...props });
    saveImpl(address)();
  };

  const informationListener: NibusSessionEvents['informationReport'] = (
    connection,
    { id, value, source },
  ) => {
    const address = source.toString();
    switch (id) {
      case ILLUMINATION:
        ipcDispatch(
          pushSensorValue({
            kind: 'illuminance',
            address,
            value,
          }),
        );
        if (!isRemoteSession) saveSensor({ address, illuminance: value });
        break;
      case TEMPERATURE:
        ipcDispatch(
          pushSensorValue({
            kind: 'temperature',
            address,
            value,
          }),
        );
        if (!isRemoteSession) saveSensor({ address, temperature: value });
        break;
      default:
        break;
    }
  };

  session.on('displays', displaysHandler);
  session.on('online', onlineHandler);
  session.on('add', addConnectionHandler);
  session.on('remove', removeConnectionHandler);
  session.on('found', foundHandler);
  session.on('pureConnection', pureConnectionHandler);
  // session.on('logLevel', logLevelHandler);
  session.on('config', configHandler);
  session.once('host', hostHandler);
  session.on('informationReport', informationListener);
  if (!isRemoteSession) {
    addForeign.then(val => val && session.on('foreign', addForeignDeviceHandler));
  }
  session.on('health', healthHandler);
  session.devices.on('new', newDeviceHandler);
  session.devices.on('delete', deleteDeviceHandler);
  const release = (): void => {
    session.off('displays', displaysHandler);
    session.off('online', onlineHandler);
    session.off('add', addConnectionHandler);
    session.off('remove', removeConnectionHandler);
    session.off('found', foundHandler);
    session.off('pureConnection', pureConnectionHandler);
    session.off('config', configHandler);
    session.off('host', hostHandler);
    session.off('informationReport', informationListener);
    session.off('foreign', addForeignDeviceHandler);
    session.off('health', healthHandler);
    session.devices.off('new', newDeviceHandler);
    session.devices.off('delete', deleteDeviceHandler);
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

export const writeToStorage = async (deviceId: DeviceId): Promise<boolean> => {
  const device = findDeviceById(deviceId);
  if (!device) {
    ipcDispatch(removeDevice(deviceId));
    return false;
  }
  const mib: string = Reflect.getMetadata('mib', device);
  if (mib !== 'minihost4') return false;
  await device.execute('save_mibs');
  return true;
};

const finder = new Finder();

finder.on('start', () => {
  ipcDispatch(resetDetected());
  ipcDispatch(setSearching(true));
});

finder.on('finish', () => {
  ipcDispatch(setSearching(false));
});

finder.on('found', info => {
  ipcDispatch(addDetected(info));
});

export const findDevices = finder.run.bind(finder);

export const cancelSearch = finder.cancel.bind(finder);

ipcRenderer.on('serviceUp', (event, remoteHost: RemoteHost) => {
  // debug('serviceUp');
  ipcDispatch(addRemoteHost(remoteHost));
});

ipcRenderer.on('serviceDown', (event, remoteHost: RemoteHost) => {
  // debug('serviceDown');
  ipcDispatch(removeRemoteHost(getRemoteId(remoteHost)));
});

ipcRenderer.on('reloadDevices', reloadDevices);

type SaveTelemetry = (x: number, y: number, temperature: number) => void;

const startTelemetry = (address: string): SaveTelemetry => {
  const timestamp = Date.now();
  return (x, y, temperature) => {
    ipcRenderer.send('addTelemetry', { timestamp, address, x, y, temperature } as TelemetryOpts);
  };
};

export const telemetry = memoize((id: DeviceId): NibusTelemetry => {
  const device = findDeviceById(id);
  if (!device) {
    telemetry.cache.delete(id);
    throw new Error(`Unknown device: ${id}`);
  }
  device.once('release', () => telemetry.cache.delete(id));
  const mib = Reflect.getMetadata('mib', device);
  let loader: Minihost2Loader | Minihost3Loader;
  switch (mib) {
    case 'minihost3':
      loader = new Minihost3Loader(id);
      break;
    case 'minihost_v2.06':
    case 'minihost_v2.06b':
      loader = new Minihost2Loader(id);
      break;
    default: {
      debug(`Telemetry is not supported, mib: ${mib}`);
      const err = new Error(`Telemetry is not supported, mib: ${mib}`);
      return { start: () => Promise.reject(err), cancel: () => Promise.reject(err) };
    }
  }
  return {
    start(options, cb) {
      const saver = isRemoteSession ? () => { } : startTelemetry(device.address.toString());
      const columnHandler = (column: Modules): void => {
        cb?.(prev => [...prev, ...column]);
        column.forEach(({ x, y, info }) => {
          const t = info?.t;
          if (typeof t !== 'undefined') saver(x, y, t);
        });
      };
      loader.on('column', columnHandler);
      cb?.([]);
      ipcDispatch(deviceBusy(id));
      return loader.run(options).finally(() => {
        loader.off('column', columnHandler);
        ipcDispatch(deviceReady(id));
      });
    },
    cancel() {
      return loader.cancel();
    },
  };
});

export const getBrightnessHistory = session.getBrightnessHistory.bind(session);

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

const successId = generateSuccessKey();

export const flash = (
  id: DeviceId,
  kind: Kind | false,
  filename: string | undefined,
  moduleSelect?: number,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    setProgress(0);
    const flasher = new Flasher(id);
    if (!kind) {
      setFlashing(true);
      resolve(flasher.resetModule(moduleSelect ?? 0xffff).finally(() => setFlashing(false)));
      return;
    }
    if (!filename) {
      resolve();
      return;
    }
    let total = 0;
    try {
      total = flasher.flash(kind, filename, moduleSelect).total;
    } catch (e) {
      reject(new Error(`Invalid source file: ${filename} (${toErrorMessage(e)})`));
      return;
    }
    flasher.once('error', e => {
      flasher.removeAllListeners();
      setFlashing(false);
      setProgress(0);
      reject(new Error(`Error while flashing: ${e}`));
    });
    setFlashing(true);
    let current = 0;
    const normalize = (value: number): number => (value * 100) / total;
    flasher.once('finish', () => {
      flasher.removeAllListeners();
      setFlashing(false);
      setProgress(0);
      resolve();
    });
    flasher.on('tick', ({ length, offset }) => {
      if (offset !== undefined) {
        current = offset;
      } else if (length !== undefined) {
        current += length;
      }
      setProgress(normalize(current));
    });
    flasher.on('module', ({ x, y, msg, moduleSelect: ms }) => {
      if (!msg) {
        enqueueSnackbar({
          id,
          kind,
          filename,
          message: `Модуль ${x},${y}: Ok`,
          options: {
            key: successId.next().value,
            variant: 'success',
          },
        });
      } else {
        enqueueSnackbar({
          id,
          kind,
          filename,
          message: msg,
          options: {
            key: ms,
            persist: true,
            variant: 'error',
          },
        });
      }
    });
  });
