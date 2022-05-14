import { connect } from 'net';

import { Connection, series as pMap } from '@novastar/codec';
import net, { findNetDevices as novaFindNetDevices } from '@novastar/net';
import ScreenConfigurator from '@novastar/screen/lib/ScreenConfigurator';
import '@novastar/screen/lib/api';
import debugFactory from 'debug';

import type { Screen, ScreenArg, ScreenBrightness } from '/@renderer/store/novastarsSlice';
import {
  addNovastar,
  novastarBusy,
  novastarReady,
  removeNovastar,
  updateNovastar,
  updateScreen,
} from '/@renderer/store/novastarsSlice';
import { pushSensorValue } from '/@renderer/store/sensorsSlice';
import { isRemoteSession } from '/@common/remote';

import memoize from 'lodash/memoize';

import type { CabinetInfo, NovastarTelemetry } from '/@common/helpers';

import NovastarLoader from './NovastarLoader';
import ipcDispatch from './ipcDispatch';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:preload `);

/*
type FilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? Key : never;
};

type NegFilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? never : Key;
};

type Func = (...args: any[]) => any;

type AllowedNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];
type MethodNames<T> = AllowedNames<T, Func>;
type PropertyNames<T> = NegFilterFlags<T, Func>[keyof T];

type Id<T> = {} & { [P in keyof T]: T[P] };

type CtrlMethods = MethodNames<ScreenConfigurator>;
type CtrlProps = PropertyNames<ScreenConfigur ator>;
*/

const novastarControls: Record<string, ScreenConfigurator> = {};

export const closeAll = () => {
  Object.values(novastarControls).forEach(ctrl => ctrl?.session.close());
};

export const createConnection = (path: string, port: number, host?: string): Promise<void> =>
  new Promise(resolve => {
    const socket = connect(port, host, () => {
      socket.write(path);
      setTimeout(async () => {
        const connection = new Connection(socket);
        const ctrl = new ScreenConfigurator(connection);
        // console.log('SESSION', Object.keys(ctrl.session));
        novastarControls[path]?.session.close();
        novastarControls[path] = ctrl;
        socket.once('close', () => {
          connection.close();
        });
        connection.once('close', () => {
          ipcDispatch(removeNovastar(path));
          // window.postMessage({ dispatch: 'removeNovastar', payload: path }, window.location.href);
          delete novastarControls[path];
          if (!socket.destroyed) socket.destroy();
        });
        resolve();
      }, 100);
    });
  });

net.on('open', address => {
  const session = net.sessions[address];
  if (!session) {
    debug(`Unknown session: ${address}`);
    return;
  }
  novastarControls[address] = new ScreenConfigurator(session);
  ipcDispatch(addNovastar({ path: address, isBusy: 0 }));
});

net.on('close', address => {
  ipcDispatch(removeNovastar(address));
  delete novastarControls[address];
});

export const findNetDevices = (): void => {
  novaFindNetDevices().then(addresses => {
    Object.entries(net.sessions)
      .filter(([address]) => !addresses.includes(address.split(':', 2)[0]))
      .forEach(([, session]) => session.close());
    addresses.forEach(address => net.open(address));
  });
};

export const reloadNovastar = async (path: string): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  ipcDispatch(novastarBusy(path));
  await controller.reload();
  const hasDVISignalIn = await controller.ReadHasDVISignalIn();
  if (hasDVISignalIn == null) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  const screens = await pMap(controller.screens, async (info, index) => {
    const screen: Screen = {
      info,
      mode: await controller.ReadFirstDisplayMode(index),
      rgbv: await controller.ReadFirstRGBVBrightness(index),
      gamma: await controller.ReadFirstGamma(index),
      chipType: await controller.ReadFirstChipType(index),
    };
    return screen;
  });
  ipcDispatch(
    updateNovastar({
      id: path,
      changes: {
        path,
        info: controller.devices[0],
        screens,
        hasDVISignalIn,
      },
    }),
  );
  ipcDispatch(novastarReady(path));
};

export const readLightSensor = async (path: string): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  const value = await controller.ReadFirstFuncCardLightSensor();
  // debug(`illuminance(${path}): ${value}`);
  value != null && ipcDispatch(pushSensorValue({ kind: 'illuminance', address: path, value }));
};

export const updateHasDviIn = async (path: string): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  const hasDVISignalIn = await controller.ReadHasDVISignalIn();
  if (hasDVISignalIn == null) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  ipcDispatch(
    updateNovastar({
      id: path,
      changes: {
        hasDVISignalIn,
      },
    }),
  );
};

export const setDisplayMode = async ({ path, screen, value }: ScreenArg<'mode'>): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  if (value == null || (await controller.WriteDisplayMode(value, screen))) {
    ipcDispatch(
      updateScreen({
        path,
        screen,
        name: 'mode',
        value,
      }),
    );
  }
};

export const setGamma = async ({ path, screen, value }: ScreenArg<'gamma'>): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  if (value == null || (await controller.WriteGamma(value, screen))) {
    ipcDispatch(
      updateScreen({
        path,
        screen,
        name: 'gamma',
        value,
      }),
    );
  }
};

export const setRGBVBrightness = async ({
  path,
  screen,
  value,
}: ScreenArg<'rgbv'>): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  if (value == null || (await controller.WriteRGBVBrightness(value, screen))) {
    ipcDispatch(
      updateScreen({
        path,
        screen,
        name: 'rgbv',
        value,
      }),
    );
  }
};

export const setBrightness = async ({ path, screen, percent }: ScreenBrightness): Promise<void> => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return;
  }
  await controller.WriteBrightness(percent, screen);
  const screens = screen === -1 ? controller.screens.map((_, index) => index) : [screen];
  await pMap(screens, async scr => {
    const value = await controller.ReadFirstRGBVBrightness(scr);
    ipcDispatch(
      updateScreen({
        path,
        screen: scr,
        name: 'rgbv',
        value,
      }),
    );
  });
};

const watchNovastar = (): void => {
  const openHandler = async (address: string): Promise<void> => {
    const session = net.sessions[address];
    if (!session) {
      debug(`Unknown session: ${address}`);
      return;
    }
    novastarControls[address] = new ScreenConfigurator(session);
    ipcDispatch(
      addNovastar({
        path: address,
        isBusy: 0,
      }),
    );
    await reloadNovastar(address);
  };

  const closeHandler = (address: string): void => {
    ipcDispatch(removeNovastar(address));
    delete novastarControls[address];
  };
  net.on('open', openHandler);
  net.on('close', closeHandler);
};

if (!isRemoteSession) watchNovastar();

export const telemetry = memoize((path: string): NovastarTelemetry | undefined => {
  const controller = novastarControls[path];
  if (!controller) {
    ipcDispatch(removeNovastar(path));
    return undefined;
  }
  controller.session.connection.once('close', () => {
    telemetry.cache.delete(path);
  });
  const loader = new NovastarLoader(controller);
  return {
    start(options, cb) {
      const cabinetHandler = (info: CabinetInfo): void => {
        cb?.(prev => [...prev, info]);
      };
      loader.on('cabinet', cabinetHandler);
      cb?.([]);
      ipcDispatch(novastarBusy(path));
      return loader.run(options).finally(() => {
        loader.off('cabinet', cabinetHandler);
        ipcDispatch(novastarReady(path));
      });
    },
    cancel: () => loader.cancel(),
  };
});

findNetDevices();
