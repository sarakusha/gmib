// eslint-disable-next-line max-classes-per-file
import type { Novastar, Screen, ScreenId } from '/@common/novastar';
import { delay, notEmpty } from '/@common/helpers';
import type { CabinetInfo, NovastarTelemetry } from '/@common/helpers';

import debugFactory from 'debug';

import { connect } from 'net';
import dgram, { type Socket } from 'dgram';
import { networkInterfaces } from 'os';

import { Connection, series } from '@novastar/codec';
import { findNetDevices, MULTICAST_ADDRESS, net, REQ, UDP_PORT } from '@novastar/net';
import ScreenConfigurator from '@novastar/screen';
import memoize from 'lodash/memoize';
import { TypedEmitter } from 'tiny-typed-emitter';

import NovastarLoader from './NovastarLoader';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:master`);

const getLocalAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flat()
    .filter(notEmpty)
    .map(info => info.address);

export const isLocalhost = (address: string) =>
  address === 'localhost' || getLocalAddresses().includes(address);
interface MasterBrowserEvents {
  add: (device: Novastar) => void;
  remove: (path: string) => void;
  update: (device: Novastar) => void;
  change: (path: string, update: Partial<Novastar>) => void;
  screen: <K extends keyof Screen>(screenId: ScreenId, key: K, value: Screen[K]) => void;
  illuminance: (address: string, value: number) => void;
  telemetry: (address: string, action: 'started' | 'finished') => void;
  cabinet: (address: string, info: CabinetInfo) => void;
  open: () => void;
  close: () => void;
  broadcastDetected: (address?: string) => void;
}

type Options = {
  dest?: string;
  interval?: number;
};

class SafeScreenConfigurator extends ScreenConfigurator {
  #isBusy = 0;

  isSerial = false;

  safeReload(): Promise<void> {
    this.#isBusy += 1;
    return this.reload()
      .catch(err => debug(`error while reload ${(err as Error).message}`))
      .finally(() => {
        this.#isBusy -= 1;
      });
  }

  get isBusy() {
    return this.#isBusy > 0;
  }
}

class MasterBrowser extends TypedEmitter<MasterBrowserEvents> {
  private novastarControls = new Map<string, SafeScreenConfigurator>();

  private broadcastDetector: Socket | undefined;

  telemetry = memoize((address: string): NovastarTelemetry | undefined => {
    const controller = this.novastarControls.get(address);
    if (!controller) {
      setTimeout(() => this.telemetry.cache.delete(address), 0);
      return undefined;
    }
    controller.session.connection.once('close', () => {
      this.telemetry.cache.delete(address);
    });
    const loader = new NovastarLoader(controller);
    return {
      start: options => {
        const cabinetHandler = (info: CabinetInfo): void => {
          this.emit('cabinet', address, info);
        };
        loader.on('cabinet', cabinetHandler);
        this.emit('change', address, { isBusy: true });
        this.emit('telemetry', address, 'started');
        return loader.run(options).finally(() => {
          loader.off('cabinet', cabinetHandler);
          this.emit('telemetry', address, 'finished');
          this.emit('change', address, { isBusy: false });
        });
      },
      cancel: () => loader.cancel(),
    };
  });

  private finder: NodeJS.Timeout | undefined;

  private running = false;

  private sensors = new Map<string, number>();

  private openHandler = (address: string) => {
    const session = net.sessions[address];
    if (!session) return;
    if (this.novastarControls.has(address)) {
      this.emit('change', address, { connected: true });
    } else {
      const controller = new SafeScreenConfigurator(session);
      this.novastarControls.set(address, controller);
      this.emit('add', { path: address, isBusy: controller.isBusy, connected: true });
      this.reload(address, true);
      setTimeout(() => this.updateState(address), 30000).unref();
    }
  };

  private disconnectHandler = (address: string) => {
    this.emit('change', address, { connected: false });
  };

  private closeHandler = (address: string) => {
    this.emit('remove', address);
    this.novastarControls.delete(address);
  };

  private async updateState(address: string): Promise<void> {
    const controller = this.novastarControls.get(address);
    if (!controller) return;
    const hasDVISignalIn = await controller.ReadHasDVISignalIn();
    if (hasDVISignalIn == null) {
      controller.session.close();
    } else {
      this.emit('change', address, {
        hasDVISignalIn,
      });
    }
    let attempts = this.sensors.get(address) ?? 3;
    if (attempts > 0) {
      const value = await controller.ReadFirstFuncCardLightSensor();
      if (value != null) {
        this.emit('illuminance', address, value);
        attempts = 3;
      }
    }
    attempts -= 1;
    if (attempts <= -5) attempts = 1;
    this.sensors.set(address, attempts);

    setTimeout(() => this.updateState(address), 30000).unref();
  }

  async getNovastar(address: string, first = false): Promise<Novastar | undefined> {
    const controller = this.novastarControls.get(address);
    if (!controller) return undefined;
    try {
      const hasDVISignalIn = await controller.ReadHasDVISignalIn();
      if (hasDVISignalIn == null) {
        controller.session.close();
        return undefined;
      }
      if (first) {
        this.emit('change', address, {
          path: address,
          info: controller.devices[0],
          hasDVISignalIn,
          isBusy: controller.isBusy,
          connected: true,
        });
      }
      const screens = controller.screens.map(info => ({ info }));
      series(controller.screens, async (info, index) => {
        const screen: Screen = {
          info,
          mode: await controller.ReadFirstDisplayMode(index),
          rgbv: await controller.ReadFirstRGBVBrightness(index),
          gamma: await controller.ReadFirstGamma(index),
          chipType: await controller.ReadFirstChipType(index),
        };
        return screen;
      }).then(scrs => this.emit('change', address, { screens: scrs, isBusy: controller.isBusy }));
      return {
        path: address,
        info: controller.devices[0],
        screens,
        hasDVISignalIn,
        isBusy: true,
        connected: true,
        isSerial: controller.isSerial,
      };
    } catch (err) {
      debug(`error while getNovastar: ${err}`);
      return undefined;
    }
  }

  async reload(address: string, first = false): Promise<void> {
    const controller = this.novastarControls.get(address);
    if (!controller) return;
    this.emit('change', address, { isBusy: true });
    await controller.safeReload();
    const novastar = await this.getNovastar(address, first);
    if (novastar) this.emit('update', novastar);
    else this.emit('change', address, { isBusy: controller.isBusy });
  }

  async setDisplayMode(screenId: ScreenId, value: Screen['mode']) {
    const controller = this.novastarControls.get(screenId.path);
    if (!controller) return;
    if (value == null || (await controller.WriteDisplayMode(value, screenId.screen)))
      this.emit('screen', screenId, 'mode', value);
  }

  async setGamma(screenId: ScreenId, value: Screen['gamma']) {
    const controller = this.novastarControls.get(screenId.path);
    if (!controller) return;
    if (value == null || (await controller.WriteGamma(value, screenId.screen)))
      this.emit('screen', screenId, 'gamma', value);
  }

  async setRGBVBrightness(screenId: ScreenId, value: Screen['rgbv']) {
    const controller = this.novastarControls.get(screenId.path);
    if (!controller) return;
    if (value == null || (await controller.WriteRGBVBrightness(value, screenId.screen)))
      this.emit('screen', screenId, 'rgbv', value);
  }

  async setBrightness(screenId: ScreenId, percent: number) {
    const controller = this.novastarControls.get(screenId.path);
    if (!controller) {
      debug(`Unknown path: ${screenId.path}`);
      return;
    }
    if (await controller.WriteBrightness(percent, screenId.screen)) {
      const screens =
        screenId.screen === -1 ? controller.screens.map((_, index) => index) : [screenId.screen];
      await series(screens, async screen => {
        const value = await controller.ReadFirstRGBVBrightness(screen);
        if (value) this.emit('screen', { path: screenId.path, screen }, 'rgbv', value);
      });
    }
  }

  openBroadcastDetector() {
    this.closeBroadcastDetector().then(() => {
      const broadcastDetector = dgram.createSocket('udp4');
      broadcastDetector.bind(UDP_PORT, () => {
        // debug(`listen on ${UDP_PORT}`);
        broadcastDetector.setBroadcast(true);
        broadcastDetector.setMulticastTTL(128);
        try {
          broadcastDetector.addMembership(MULTICAST_ADDRESS);
        } catch (e) {
          debug(`error while addMembership: ${(e as Error).message}`);
        }
      });
      broadcastDetector.on('message', (msg, remote) => {
        // debug(`MULTICAST: ${msg}, ${JSON.stringify(remote)}`);
        if (msg.toString().startsWith(REQ)) this.emit('broadcastDetected', remote.address);
      });
      broadcastDetector.once('error', err => debug(`error while detector: ${err.message}`));
      this.broadcastDetector = broadcastDetector;
    });
  }

  closeBroadcastDetector(): Promise<void> {
    return new Promise<void>(resolve => {
      const { broadcastDetector } = this;
      if (!broadcastDetector) {
        resolve();
      } else {
        this.broadcastDetector = undefined;
        broadcastDetector.close(() => {
          setTimeout(() => broadcastDetector.removeAllListeners(), 0);
          resolve();
        });
      }
    });
  }

  open({ dest, interval = 30000 }: Options = {}): boolean {
    if (this.running) return false;
    this.running = true;
    const updateDevices = async () => {
      try {
        await this.closeBroadcastDetector();
        const addresses = await findNetDevices(dest);
        // debug(`found: ${addresses.join(', ')}`);
        this.openBroadcastDetector();
        addresses.forEach(address => {
          if (!this.novastarControls.has(address)) {
            net.open(address);
          }
        });
      } finally {
        this.finder = setTimeout(updateDevices, interval);
      }
    };

    net.on('open', this.openHandler);
    net.on('disconnect', this.disconnectHandler);
    net.on('close', this.closeHandler);

    updateDevices();
    this.emit('open');

    return true;
  }

  async close(): Promise<boolean> {
    if (!this.running) return false;
    this.running = false;
    clearTimeout(this.finder);
    [...this.novastarControls.values()].forEach(control => control.session.close());
    this.novastarControls.clear();
    this.closeBroadcastDetector();
    await delay(0);
    this.emit('close');
    return true;
  }

  getAll = (): Promise<Novastar[]> =>
    Promise.all(
      [...this.novastarControls.keys()].map(address => this.getNovastar(address, true)),
    ).then(results => results.filter(notEmpty));

  /**
   * Connect to shared serial connection
   * @param path
   * @param port
   * @param host
   */
  createSerialConnection(path: string, port: number, host = ''): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = `${isLocalhost(host) ? '' : host}${path.startsWith('/') ? '' : '/'}${path}`;
      if (this.novastarControls.has(id)) resolve();
      const socket = connect(port, host, () => {
        socket.write(path);
        setTimeout(async () => {
          const connection = new Connection(socket);
          const ctrl = new SafeScreenConfigurator(connection);
          ctrl.isSerial = true;
          // console.log('SESSION', Object.keys(ctrl.session));
          this.novastarControls.get(id)?.session.close();
          this.novastarControls.set(id, ctrl);
          this.emit('add', { path: id, isBusy: ctrl.isBusy, connected: true });
          setTimeout(() => this.reload(id, true), 1000);
          setTimeout(() => this.updateState(id), 30000).unref();
          socket.once('close', () => {
            connection.close();
          });
          connection.once('close', () => {
            if (this.novastarControls.get(id) === ctrl) {
              this.emit('remove', id);
              this.novastarControls.delete(id);
            }
            if (!socket.destroyed) socket.destroy();
          });
          resolve();
        }, 100);
      });
      socket.once('error', reject);
    });
  }
}

export default new MasterBrowser();
