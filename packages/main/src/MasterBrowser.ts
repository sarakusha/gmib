import {
  getMatchingTaurusSerials,
  getTaurusPath,
  isTaurusPath,
  type Novastar,
  type Screen,
  type ScreenId,
  TAURUS_ALL_PATH,
} from '/@common/novastar';
import { asyncSerial, delay, notEmpty, reIPv4 } from '/@common/helpers';
import type { CabinetInfo, NovastarTelemetry } from '/@common/helpers';

import debugFactory from 'debug';

import { createHash } from 'crypto';
import { connect } from 'net';
import dgram, { type Socket } from 'dgram';
import { networkInterfaces } from 'os';
import flatten from 'lodash/flatten';

import { Connection, series } from '@novastar/codec';
import { findNetDevices, MULTICAST_ADDRESS, net, REQ, UDP_PORT } from '@novastar/net';
import { loadNcpConfig, ScreenConfigurator } from '@novastar/screen';
import {
  discoverTaurusPlayers,
  TAURUS_FTP_PORT,
  TaurusClient,
  type TaurusLedScreenConfiguration,
  type TaurusPlayerInfo,
  TaurusReceivingCardConfigStatus,
  TaurusResponseError,
  uploadTaurusFile,
} from '@novastar/taurus';
import memoize from 'lodash/memoize';
import { TypedEmitter } from 'tiny-typed-emitter';

import NovastarLoader from './NovastarLoader';
import ExternalBroadcastDetection from './externalBroadcastDetection';
import { probeGmibAddress } from './remoteGmib';
import { getAddressesForScreen, getScreens } from './screen';
import { getTaurusNcpTargets, inspectTaurusNcp, validateTaurusNcpFilename } from './taurusNcp';
import { inspectTaurusScr, writeAndVerifyTaurusConfiguration } from './taurusScr';
import localConfig from './localConfig';
import {
  createWindowsMdnsFirewallCommands,
  type WindowsMdnsFirewallWarning,
} from './windowsFirewall';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:master`);
const BROADCAST_DETECTION_DELAY_MS = 10000;

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
  gmibDiscoveryBlocked: (warning: WindowsMdnsFirewallWarning) => void;
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

  timeout: NodeJS.Timeout | undefined;
}

type TaurusControl = {
  info: TaurusPlayerInfo;
  client?: TaurusClient;
  connecting?: Promise<void>;
  configurationBusy?: boolean;
  loginFailed?: boolean;
  brightness?: number;
  illuminance?: number;
  timeout?: NodeJS.Timeout;
};

class MasterBrowser extends TypedEmitter<MasterBrowserEvents> {
  #unknownPath = new Set<string>();

  private gmibAddressSources = new Map<string, Set<string>>();

  private novastarControls = new Map<string, SafeScreenConfigurator>();

  private taurusControls = new Map<string, TaurusControl>();

  private broadcastDetector: Socket | undefined;

  private externalBroadcastDetection = new ExternalBroadcastDetection({
    delay: BROADCAST_DETECTION_DELAY_MS,
    isKnownAddress: address => this.isKnownGmibAddress(address),
    confirmExternalAddress: async address => !(await probeGmibAddress(address)),
    onDetected: address => {
      debug(`external NovaStar broadcast detected: ${address}`);
      this.emit('broadcastDetected', address);
    },
    onSuppressed: address => {
      debug(`GMIB ${address} responds to HTTP but was not discovered over mDNS`);
      if (process.platform === 'win32') {
        this.emit('gmibDiscoveryBlocked', {
          address,
          commands: createWindowsMdnsFirewallCommands(process.execPath),
        });
      }
    },
  });

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

  registerGmibAddresses(source: string, addresses: string[]): void {
    this.unregisterGmibAddresses(source);
    addresses
      .filter(address => reIPv4.test(address))
      .forEach(address => {
        const sources = this.gmibAddressSources.get(address) ?? new Set<string>();
        sources.add(source);
        this.gmibAddressSources.set(address, sources);
        this.externalBroadcastDetection.markKnown(address);
      });
  }

  unregisterGmibAddresses(source: string): void {
    this.gmibAddressSources.forEach((sources, address) => {
      sources.delete(source);
      if (sources.size === 0) this.gmibAddressSources.delete(address);
    });
  }

  private isKnownGmibAddress(address: string): boolean {
    return isLocalhost(address) || this.gmibAddressSources.has(address);
  }

  private emitBroadcastDetected(address: string): void {
    this.externalBroadcastDetection.observe(address);
  }

  private openHandler = (address: string) => {
    const session = net.sessions[address];
    debug(`open ${address}, session: ${session ? 'found' : 'missing'}`);
    if (!session) return;
    if (address.endsWith(':5200') && this.hasTaurusHost(address.slice(0, -5))) {
      session.close();
      return;
    }
    if (this.novastarControls.has(address)) {
      this.emit('change', address, { connected: true });
    } else {
      const controller = new SafeScreenConfigurator(session);
      this.novastarControls.set(address, controller);
      this.emit('add', { path: address, isBusy: controller.isBusy, connected: true });
      void this.reload(address, true);
      setTimeout(() => {
        void this.updateState(address);
      }, 30000).unref();
    }
  };

  private openNetDevice(address: string): void {
    const session = net.open(address);
    const fullAddress = address.includes(':') ? address : `${address}:5200`;
    let handled = false;
    const handleOpen = () => {
      if (handled) return;
      handled = true;
      session.connection.off('open', handleOpen);
      this.openHandler(fullAddress);
    };
    session.connection.once('open', handleOpen);
    setTimeout(handleOpen, 1000).unref();
  }

  private hasNetDevice(address: string): boolean {
    const fullAddress = address.includes(':') ? address : `${address}:5200`;
    return this.novastarControls.has(fullAddress) || net.sessions[fullAddress] != null;
  }

  private hasTaurusHost(address: string): boolean {
    return [...this.taurusControls.values()].some(control => control.info.address === address);
  }

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

    setTimeout(() => {
      void this.updateState(address);
    }, 30000).unref();
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
      void series(controller.screens, async (info, index) => {
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
    const taurus = this.taurusControls.get(address);
    if (taurus) {
      if (taurus.client) {
        this.emit('change', address, { isBusy: true });
        try {
          await this.updateTaurusState(address);
        } finally {
          this.emit('change', address, { isBusy: false });
        }
      } else {
        taurus.loginFailed = false;
        await this.connectTaurus(address).catch(() => undefined);
      }
      return;
    }
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
    const allTaurusEntries = [...this.taurusControls.entries()];
    const matchingSerials = new Set(
      getMatchingTaurusSerials(
        screenId.path,
        allTaurusEntries.map(([, control]) => control.info.sn),
      ),
    );
    const taurusEntries =
      screenId.path === TAURUS_ALL_PATH
        ? allTaurusEntries
        : isTaurusPath(screenId.path)
          ? allTaurusEntries.filter(([, control]) => matchingSerials.has(control.info.sn))
          : allTaurusEntries.filter(
              ([, control]) => control.info.address === screenId.path.split(':', 1)[0],
            );
    if (screenId.screen === -1 && (isTaurusPath(screenId.path) || taurusEntries.length > 0)) {
      if (screenId.path !== TAURUS_ALL_PATH && taurusEntries.length > 1) {
        throw new Error(
          `Неоднозначный серийный номер Taurus ${screenId.path}: ${taurusEntries
            .map(([, control]) => control.info.sn)
            .join(', ')}`,
        );
      }
      await Promise.all(
        taurusEntries.map(async ([path]) => {
          const control = this.taurusControls.get(path);
          if (!control?.client) return;
          await control.client.setBrightness(percent);
          control.brightness = percent;
          this.emit('change', path, { taurus: this.getTaurusState(control) });
        }),
      );
      return;
    }
    const controller = this.novastarControls.get(screenId.path);
    // debug('setBrightness: %d [%s]', percent, screenId.path);
    if (!controller) {
      if (!this.#unknownPath.has(screenId.path)) {
        debug(`Unknown path: ${screenId.path}`);
        this.#unknownPath.add(screenId.path);
      }
      return;
    }
    this.#unknownPath.delete(screenId.path);
    if (await controller.WriteBrightness(percent, screenId.screen)) {
      clearTimeout(controller.timeout);
      controller.timeout = setTimeout(() => {
        void (async () => {
          const screens =
            screenId.screen === -1
              ? controller.screens.map((_, index) => index)
              : [screenId.screen];
          await series(screens, async screen => {
            const value = await controller.ReadFirstRGBVBrightness(screen);
            // debug(`readRGBV: ${value}`);
            if (value) this.emit('screen', { path: screenId.path, screen }, 'rgbv', value);
          });
        })();
      }, 1000);
    }
  }

  private getTaurusState(control: TaurusControl): NonNullable<Novastar['taurus']> {
    const { info } = control;
    const hasPassword = Boolean(
      localConfig.get('taurusPasswords')?.[info.sn] ?? process.env.NOVASTAR_TAURUS_PASSWORD,
    );
    return {
      address: info.address,
      port: info.tcpPort,
      aliasName: info.aliasName,
      productName: info.productName,
      serialNumber: info.sn,
      platform: info.platform,
      width: info.width,
      height: info.height,
      authenticated: Boolean(control.client),
      passwordRequired: !control.client && (Boolean(control.loginFailed) || !hasPassword),
      brightness: control.brightness,
      illuminance: control.illuminance,
    };
  }

  private addTaurus(info: TaurusPlayerInfo): void {
    const path = getTaurusPath(info.sn);
    const legacyPath = `${info.address}:5200`;
    if (this.novastarControls.has(legacyPath) || net.sessions[legacyPath]) {
      net.close(legacyPath);
    }
    const current = this.taurusControls.get(path);
    if (current) {
      current.info = info;
      this.emit('change', path, { connected: true, taurus: this.getTaurusState(current) });
      if (!current.client && !current.connecting && !current.loginFailed) {
        void this.connectTaurus(path).catch(() => undefined);
      }
      return;
    }
    const control: TaurusControl = { info };
    this.taurusControls.set(path, control);
    this.emit('add', {
      path,
      isBusy: false,
      connected: true,
      taurus: this.getTaurusState(control),
    });
    void this.connectTaurus(path).catch(() => undefined);
  }

  private handleTaurusDisconnect(
    path: string,
    client: TaurusClient,
    error = 'Taurus connection closed',
  ): void {
    const control = this.taurusControls.get(path);
    if (!control) return;
    if (control.client !== client) return;
    control.client = undefined;
    this.emit('change', path, {
      connected: false,
      error,
      taurus: this.getTaurusState(control),
    });
    clearTimeout(control.timeout);
    if (!control.loginFailed && this.running) {
      control.timeout = setTimeout(() => {
        void this.connectTaurus(path).catch(() => undefined);
      }, 1000);
      control.timeout.unref();
    }
  }

  private async connectTaurus(path: string, passwordOverride?: string): Promise<void> {
    const control = this.taurusControls.get(path);
    if (!control) throw new Error(`Unknown Taurus player: ${path}`);
    if (control.connecting) return control.connecting;
    const password =
      passwordOverride ??
      localConfig.get('taurusPasswords')?.[control.info.sn] ??
      process.env.NOVASTAR_TAURUS_PASSWORD;
    if (!password) {
      this.emit('change', path, {
        isBusy: false,
        error: 'Требуется пароль Taurus',
        taurus: this.getTaurusState(control),
      });
      return;
    }

    const connecting = (async () => {
      this.emit('change', path, { isBusy: true, error: undefined });
      control.client?.close();
      control.client = undefined;
      let client: TaurusClient | undefined;
      try {
        client = await TaurusClient.connect({
          host: control.info.address,
          port: control.info.tcpPort,
          privacy: control.info.privacy,
        });
        const result = await client.login({ sn: control.info.sn, password });
        if (!result.logined) throw new Error('Taurus login was rejected');
        const connectedClient = client;
        control.client = connectedClient;
        connectedClient.connection.stream.once('close', () => {
          this.handleTaurusDisconnect(path, connectedClient);
        });
        control.loginFailed = false;
        if (passwordOverride) {
          localConfig.set('taurusPasswords', {
            ...localConfig.get('taurusPasswords'),
            [control.info.sn]: passwordOverride,
          });
        }
        this.emit('change', path, {
          connected: true,
          isBusy: false,
          error: undefined,
          taurus: this.getTaurusState(control),
        });
        await this.updateTaurusState(path);
      } catch (error) {
        client?.close();
        control.loginFailed = error instanceof TaurusResponseError;
        this.emit('change', path, {
          connected: control.loginFailed,
          isBusy: false,
          error: (error as Error).message,
          taurus: this.getTaurusState(control),
        });
        throw error;
      }
    })();
    control.connecting = connecting;
    try {
      await connecting;
    } finally {
      control.connecting = undefined;
    }
  }

  private async updateTaurusState(path: string): Promise<void> {
    const control = this.taurusControls.get(path);
    if (!control?.client) return;
    const { client } = control;
    clearTimeout(control.timeout);
    const [brightness, illuminance] = await Promise.allSettled([
      client.getBrightness(),
      client.getEnvironmentBrightness(),
    ]);
    if (brightness.status === 'rejected' && illuminance.status === 'rejected') {
      client.close();
      this.handleTaurusDisconnect(
        path,
        client,
        brightness.reason instanceof Error ? brightness.reason.message : String(brightness.reason),
      );
      return;
    }
    if (control.client !== client) return;
    if (brightness.status === 'fulfilled') control.brightness = brightness.value.ratio;
    if (illuminance.status === 'fulfilled') {
      control.illuminance = illuminance.value;
      this.emit('illuminance', path, illuminance.value);
    }
    const taurus = this.getTaurusState(control);
    this.emit('change', path, { connected: true, error: undefined, taurus });
    control.timeout = setTimeout(() => void this.updateTaurusState(path), 30000);
    control.timeout.unref();
  }

  async loginTaurus(path: string, password: string): Promise<void> {
    if (!password) throw new Error('Taurus password is empty');
    const control = this.taurusControls.get(path);
    if (!control) throw new Error(`Unknown Taurus player: ${path}`);
    control.loginFailed = false;
    await this.connectTaurus(path, password);
  }

  private getTaurusClient(path: string): { control: TaurusControl; client: TaurusClient } {
    const control = this.taurusControls.get(path);
    if (!control) throw new Error(`Unknown Taurus player: ${path}`);
    if (!control.client) throw new Error('Taurus authentication is required');
    return { control, client: control.client };
  }

  private getTaurusConfigurationBackup(
    control: TaurusControl,
  ): TaurusLedScreenConfiguration | undefined {
    return localConfig.get('taurusConfigurationBackups')?.[control.info.sn];
  }

  private setTaurusConfigurationBackup(
    control: TaurusControl,
    configuration: TaurusLedScreenConfiguration | undefined,
  ): void {
    const backups = localConfig.get('taurusConfigurationBackups') ?? {};
    if (configuration) {
      localConfig.set('taurusConfigurationBackups', {
        ...backups,
        [control.info.sn]: configuration,
      });
      return;
    }
    const { [control.info.sn]: _removed, ...remaining } = backups;
    localConfig.set('taurusConfigurationBackups', remaining);
  }

  async getTaurusScreenConfiguration(path: string) {
    const { control, client } = this.getTaurusClient(path);
    return {
      current: await client.getLedScreenConfiguration(),
      backupAvailable: Boolean(this.getTaurusConfigurationBackup(control)),
    };
  }

  async inspectTaurusScreenConfiguration(path: string, filename: string) {
    const state = await this.getTaurusScreenConfiguration(path);
    return inspectTaurusScr(filename, state.current, state.backupAvailable);
  }

  async inspectTaurusNcpConfiguration(path: string, filename: string) {
    const { client } = this.getTaurusClient(path);
    return inspectTaurusNcp(filename, await client.getLedScreenConfiguration());
  }

  async applyTaurusScreenConfiguration(path: string, filename: string) {
    const { control, client } = this.getTaurusClient(path);
    if (control.configurationBusy) throw new Error('Taurus configuration write is already running');
    control.configurationBusy = true;
    try {
      const current = await client.getLedScreenConfiguration();
      const inspection = inspectTaurusScr(
        filename,
        current,
        Boolean(this.getTaurusConfigurationBackup(control)),
      );
      if (!this.getTaurusConfigurationBackup(control)) {
        this.setTaurusConfigurationBackup(control, current);
      }
      this.emit('change', path, { isBusy: true, error: undefined });
      const actual = await writeAndVerifyTaurusConfiguration(client, inspection.target);
      const width = Math.max(...actual.screens.map(screen => screen.offset.x + screen.size.width));
      const height = Math.max(
        ...actual.screens.map(screen => screen.offset.y + screen.size.height),
      );
      control.info = { ...control.info, width, height };
      const result = {
        current: actual,
        backupAvailable: true,
      };
      this.emit('change', path, {
        connected: true,
        isBusy: false,
        error: undefined,
        taurus: this.getTaurusState(control),
      });
      return result;
    } catch (error) {
      this.emit('change', path, {
        isBusy: false,
        error: (error as Error).message,
        taurus: this.getTaurusState(control),
      });
      throw error;
    } finally {
      control.configurationBusy = false;
    }
  }

  async restoreTaurusScreenConfiguration(path: string) {
    const { control, client } = this.getTaurusClient(path);
    if (control.configurationBusy) throw new Error('Taurus configuration write is already running');
    const backup = this.getTaurusConfigurationBackup(control);
    if (!backup) throw new Error('No Taurus screen configuration backup is available');
    control.configurationBusy = true;
    this.emit('change', path, { isBusy: true, error: undefined });
    try {
      const actual = await writeAndVerifyTaurusConfiguration(client, backup);
      this.setTaurusConfigurationBackup(control, undefined);
      const width = Math.max(...actual.screens.map(screen => screen.offset.x + screen.size.width));
      const height = Math.max(
        ...actual.screens.map(screen => screen.offset.y + screen.size.height),
      );
      control.info = { ...control.info, width, height };
      const result = { current: actual, backupAvailable: false };
      this.emit('change', path, {
        connected: true,
        isBusy: false,
        error: undefined,
        taurus: this.getTaurusState(control),
      });
      return result;
    } catch (error) {
      this.emit('change', path, {
        isBusy: false,
        error: (error as Error).message,
        taurus: this.getTaurusState(control),
      });
      throw error;
    } finally {
      control.configurationBusy = false;
    }
  }

  async applyTaurusNcpConfiguration(
    path: string,
    filename: string,
    cabinetIndex: number,
    requestedTargets: Array<{ port: number; receivingCard: number }>,
  ) {
    const { control, client } = this.getTaurusClient(path);
    if (control.configurationBusy) throw new Error('Taurus configuration write is already running');
    if (!Number.isInteger(cabinetIndex) || cabinetIndex < 0) {
      throw new RangeError('Invalid NCP cabinet index');
    }
    validateTaurusNcpFilename(filename);
    if (!requestedTargets.length) throw new RangeError('Select at least one receiving card');
    control.configurationBusy = true;
    this.emit('change', path, { isBusy: true, error: undefined });
    try {
      const topology = await client.getLedScreenConfiguration();
      const availableTargets = new Set(
        getTaurusNcpTargets(topology).map(target => `${target.port}:${target.receivingCard}`),
      );
      const uniqueTargets = [
        ...new Map(
          requestedTargets.map(target => [`${target.port}:${target.receivingCard}`, target]),
        ).values(),
      ];
      uniqueTargets.forEach(target => {
        if (!availableTargets.has(`${target.port}:${target.receivingCard}`)) {
          throw new RangeError(
            `Receiving card ${target.receivingCard + 1} on port ${target.port + 1} is not configured`,
          );
        }
      });
      const decoded = await loadNcpConfig(filename);
      const cabinet = decoded.cabinets[cabinetIndex];
      if (!cabinet) throw new RangeError('NCP cabinet was not found');
      const md5 = createHash('md5').update(cabinet.binary).digest('hex');
      const safeName =
        cabinet.name.replace(/[^a-z\d._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cabinet';
      const ftpPath = `/sdcard/gmib/${safeName}-${md5.slice(0, 12)}.bin`;
      const devicePath = `/mnt${ftpPath}`;
      await uploadTaurusFile({
        host: control.info.address,
        port: control.info.ftpPort ?? TAURUS_FTP_PORT,
        password: await client.getFtpPassword(),
        remotePath: ftpPath,
        data: cabinet.binary,
      });
      await client.applyReceivingCardConfiguration(
        uniqueTargets.map(target => ({
          filePath: devicePath,
          md5,
          port: target.port,
          receivingCard: target.receivingCard,
        })),
      );
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await delay(0.5);
        const progress = await client.getReceivingCardConfigProgress();
        if (progress.status === TaurusReceivingCardConfigStatus.Completed) {
          this.emit('change', path, {
            connected: true,
            isBusy: false,
            error: undefined,
            taurus: this.getTaurusState(control),
          });
          return {
            completed: progress.completed,
            total: progress.total,
            progress: progress.progress,
          };
        }
        if (progress.status === TaurusReceivingCardConfigStatus.Failed) {
          throw new Error(
            progress.errorMessage ??
              `Taurus receiving-card configuration failed${
                progress.errorCode === undefined ? '' : ` (${progress.errorCode})`
              }`,
          );
        }
      }
      throw new Error('Taurus receiving-card configuration timed out');
    } catch (error) {
      this.emit('change', path, {
        isBusy: false,
        error: (error as Error).message,
        taurus: this.getTaurusState(control),
      });
      throw error;
    } finally {
      control.configurationBusy = false;
    }
  }

  openBroadcastDetector() {
    void this.closeBroadcastDetector().then(() => {
      if (!this.running) return;
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
        if (msg.toString().startsWith(REQ)) this.emitBroadcastDetected(remote.address);
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
        this.externalBroadcastDetection.clearPending();
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
      if (!this.running) return;
      try {
        await this.closeBroadcastDetector();
        if (!this.running) return;
        const screens = await getScreens();
        if (!this.running) return;
        const hardAddresses = flatten(
          await asyncSerial(screens, screen => getAddressesForScreen(screen.id)),
        ).filter(address => reIPv4.test(address));
        if (!this.running) return;
        hardAddresses.forEach(address => {
          if (!this.hasNetDevice(address)) {
            this.openNetDevice(address);
          }
        });
        const [addresses, taurusPlayers] = await Promise.all([
          findNetDevices(dest),
          discoverTaurusPlayers(dest),
        ]);
        if (!this.running) return;
        // debug(`found: ${addresses.join(', ')}`);
        this.openBroadcastDetector();
        const taurusAddresses = new Set(taurusPlayers.map(player => player.address));
        addresses.forEach(address => {
          if (taurusAddresses.has(address)) return;
          if (!this.hasNetDevice(address) && !hardAddresses.includes(address)) {
            this.openNetDevice(address);
          }
        });
        taurusPlayers.forEach(player => this.addTaurus(player));
      } finally {
        if (this.running) {
          this.finder = setTimeout(() => {
            void updateDevices();
          }, interval);
        }
      }
    };

    net.on('open', this.openHandler);
    net.on('disconnect', this.disconnectHandler);
    net.on('close', this.closeHandler);

    void updateDevices();
    this.emit('open');

    return true;
  }

  async close(): Promise<boolean> {
    if (!this.running) return false;
    this.running = false;
    clearTimeout(this.finder);
    net.off('open', this.openHandler);
    net.off('disconnect', this.disconnectHandler);
    net.off('close', this.closeHandler);
    [...this.novastarControls.values()].forEach(control => control.session.close());
    this.novastarControls.clear();
    [...this.taurusControls.values()].forEach(control => {
      clearTimeout(control.timeout);
      control.client?.close();
    });
    this.taurusControls.clear();
    await this.closeBroadcastDetector();
    this.externalBroadcastDetection.reset();
    await delay(0);
    this.emit('close');
    return true;
  }

  getAll = (): Promise<Novastar[]> => {
    debug(`getAll: ${[...this.novastarControls.keys(), ...this.taurusControls.keys()].join(', ')}`);
    const controllers = Promise.all(
      [...this.novastarControls.entries()].map(async ([address, controller]) => {
        const novastar = await this.getNovastar(address, true);
        return (
          novastar ?? {
            path: address,
            isBusy: controller.isBusy,
            connected: true,
            isSerial: controller.isSerial,
          }
        );
      }),
    );
    return controllers.then(items => [
      ...items,
      ...[...this.taurusControls.entries()].map(([path, control]) => ({
        path,
        isBusy: Boolean(control.connecting),
        connected: true,
        taurus: this.getTaurusState(control),
      })),
    ]);
  };

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
        setTimeout(() => {
          const connection = new Connection(socket);
          const ctrl = new SafeScreenConfigurator(connection);
          ctrl.isSerial = true;
          // console.log('SESSION', Object.keys(ctrl.session));
          this.novastarControls.get(id)?.session.close();
          this.novastarControls.set(id, ctrl);
          this.emit('add', { path: id, isBusy: ctrl.isBusy, connected: true });
          setTimeout(() => {
            void this.reload(id, true);
          }, 1000);
          setTimeout(() => {
            void this.updateState(id);
          }, 30000).unref();
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
