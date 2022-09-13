import { ipcRenderer } from 'electron';

import type {
  Address,
  DeviceId,
  Display,
  FoundListener,
  Host,
  IDevice,
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
import { addNovastar } from '/@renderer/store/novastarsSlice';
import { addRemoteHost, getRemoteId, removeRemoteHost } from '/@renderer/store/remoteHostsSlice';
import { ILLUMINATION, pushSensorValue, TEMPERATURE } from '/@renderer/store/sensorsSlice';
import {
  addDetected,
  releaseSession,
  resetDetected,
  setDevices,
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
  ValueState,
  ValueType,
} from '/@common/helpers';
import { toErrorMessage } from '/@common/helpers';

import Finder from './Finder';
import Minihost2Loader from './Minihost2Loader';
import Minihost3Loader from './Minihost3Loader';

import ipcDispatch from '/@common/ipcDispatch';

import { createConnection } from './novastar';

import { validateConfig } from '/@common/schema';
import { enqueueSnackbar, setFlashing, setProgress } from '/@renderer/store/flasherSlice';

export type { Address };
// import patchEmitter from './patchEmitter';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload`);
const RESTART_DELAY = 3000;
const PING_INTERVAL = 10000;

debug('Hello from nibus-preload');

let isConnected = false;

const query = new URLSearchParams(window.location.search);
const port = +(query.get('port') ?? 9001);
const host = query.get('host') ?? 'localhost';

const session = getNibusSession(port, host);

// patchEmitter(session, 'session');

session.on('log', line => {
  ipcDispatch(addLog(line));
});

// console.log({ location: window.location });

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

const isRemoteSession = host !== 'localhost';

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
    return () => Promise.reject(new Error('Unknown device'));
  }
  const drainDevice = debounce(
    async (): Promise<void> => {
      const ids = await device.drain();
      if (ids.length === 0) return;
      const failed = ids.filter(ident => ident < 0).map(ident => -ident);
      failed.length > 0 && (await device.read(...failed));
      ipcDispatch(updateProps([deviceId, getProps(device, ids.map(Math.abs))]));
    },
    400,
    { leading: true },
  );
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
    drainDevice();
  };
};

export const sendConfig = debounce((state: Record<string, unknown>): void => {
  const { loading, ...config } = state;
  if (!validateConfig(config)) debug('error while validate config');
  session.saveConfig({ ...config });
}, 500);

(function openSession() {
  const updatePortsHandler = (): void => {
    ipcDispatch(setPortCount(session.ports));
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
  const updateDevices = (): void => {
    ipcDispatch(setDevices(session.devices.get().map(device => device.id)));
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

  const addForeignDeviceHandler = async ({
    portInfo: { path },
    description,
  }: PortArg): Promise<void> => {
    if (description.category !== 'novastar') return;
    await createConnection(path, port, host);
    ipcDispatch(
      addNovastar({
        path,
        isBusy: 0,
        connected: true,
      }),
    );
  };

  const informationListener: NibusSessionEvents['informationReport'] = (
    connection,
    { id, value, source },
  ) => {
    switch (id) {
      case ILLUMINATION:
        ipcDispatch(
          pushSensorValue({
            kind: 'illuminance',
            address: source.toString(),
            value,
          }),
        );
        break;
      case TEMPERATURE:
        ipcDispatch(
          pushSensorValue({
            kind: 'temperature',
            address: source.toString(),
            value,
          }),
        );
        break;
      default:
        break;
    }
  };

  session.on('displays', displaysHandler);
  session.on('online', onlineHandler);
  session.on('add', updatePortsHandler);
  session.on('remove', updatePortsHandler);
  session.on('found', foundHandler);
  // session.on('logLevel', logLevelHandler);
  session.on('config', configHandler);
  session.once('host', hostHandler);
  session.on('informationReport', informationListener);
  session.on('foreign', addForeignDeviceHandler);
  session.on('health', healthHandler);
  session.devices.on('new', updateDevices);
  session.devices.on('delete', updateDevices);
  const release = (): void => {
    // ipcDispatch(releaseNovastars());
    // Object.values(novastarSessions).forEach(novastarSession => novastarSession.close());
    session.off('displays', displaysHandler);
    session.off('online', onlineHandler);
    session.off('add', updatePortsHandler);
    session.off('remove', updatePortsHandler);
    session.off('found', foundHandler);
    // session.off('logLevel', logLevelHandler);
    session.off('config', configHandler);
    session.off('host', hostHandler);
    session.off('informationReport', informationListener);
    session.off('foreign', addForeignDeviceHandler);
    session.off('health', healthHandler);
    session.devices.off('new', updateDevices);
    session.devices.off('delete', updateDevices);
    // removeDevicesListener();
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
    // const { status } = selectSession(getState() as RootState);
    // if (status === 'closed' || status === 'succeeded') return;
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
})();

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
    const checkConnection = async (): Promise<void> => {
      await session.pingDevice(device);
    };
    const timer = window.setInterval(checkConnection, PING_INTERVAL);
    device.once('release', () => window.clearInterval(timer));
  }
  ipcDispatch(setParent([device.id, parent]));
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
  ipcDispatch(deviceReady(deviceId));
  ipcDispatch(updateProps([deviceId, getProps(device)]));
};

export const releaseDevice = (deviceId: DeviceId): void => {
  const device = findDeviceById(deviceId);
  if (!device) {
    ipcDispatch(removeDevice(deviceId));
    return;
  }
  device.release();
};

(function init() {
  const newDeviceHandler = async (device: IDevice): Promise<void> => {
    const { id: deviceId, address, connection } = device;
    // const mib = Reflect.getMetadata('mib', device);
    const connectedHandler = (): void => {
      ipcDispatch(setConnected([deviceId, !!device.connection]));
      // ipcDispatch(reloadDevice(deviceId));
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
    // await device.read();
    // const entity: DeviceState = {
    //   id: deviceId,
    //   address: address.toString(),
    //   connected: !!connection,
    //   path: connection?.path,
    //   mib: Reflect.getMetadata('mib', device),
    //   isEmptyAddress: address.isEmpty,
    //   props: getProps(device),
    //   isBusy: 0,
    // };
    if (connection?.owner === device) {
      entity.isLinkingDevice = connection.description.link;
      entity.category = connection.description.category;
    }
    ipcDispatch(addDevice(entity));
    await reloadDevice(deviceId);
    /*
        setTimeout(() => {
          if (!device.connection) return;
          device.read().finally(() => {
            ipcDispatch(updateProps([deviceId]));
            ipcDispatch(deviceReady(deviceId));
            // debug(`deviceReady ${device.address.toString()}`);
            // selectCurrentDeviceId(getState()) || ipcDispatch(setCurrentDevice(deviceId));
            const brightness = selectBrightness(getState());
            const setValue = setDeviceValue(deviceId);
            if (mib?.startsWith('minihost') || mib === 'mcdvi') {
              setValue('brightness', brightness);
            }
            ipcDispatch(updateScreen());
          });
        }, 3000);
    */
  };
  const deleteDeviceHandler = (device: IDevice): void => {
    try {
      ipcDispatch(removeDevice(device.id));
    } catch (e) {
      debug(toErrorMessage(e));
    }
  };
  session.devices.on('new', newDeviceHandler);
  session.devices.on('delete', deleteDeviceHandler);
  return () => {
    session.devices.off('new', newDeviceHandler);
    session.devices.off('delete', deleteDeviceHandler);
  };
})();

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
  debug('serviceUp');
  ipcDispatch(addRemoteHost(remoteHost));
});

ipcRenderer.on('serviceDown', (event, remoteHost: RemoteHost) => {
  debug('serviceDown');
  ipcDispatch(removeRemoteHost(getRemoteId(remoteHost)));
});

type SaveTelemetry = (x: number, y: number, temperature: number) => void;

const startTelemetry = (address: string): SaveTelemetry => {
  const timestamp = Date.now();
  return (x, y, temperature) => {
    ipcRenderer.send('addTelemetry', timestamp, address, x, y, temperature);
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
    case 'minihost_v2.06b':
      loader = new Minihost2Loader(id);
      break;
    default:
      throw new Error(`Invalid mib: ${mib}`);
  }
  return {
    start(options, cb) {
      const saver = startTelemetry(device.address.toString());
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

const entries = <T>(obj: T): EntryType<T>[] => Object.entries(obj) as EntryType<T>[];

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
