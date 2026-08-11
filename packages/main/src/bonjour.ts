import { app } from 'electron';
import { EventEmitter } from 'node:events';
import type { RemoteInfo } from 'node:dgram';

import BonjourService from 'bonjour-service';
import debugFactory from 'debug';

import { getBonjourInterfaces, selectBonjourAddressRecords } from './bonjourInterface';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:bonjour`);

export type ServiceOptions = {
  name: string;
  host?: string;
  port: number;
  type: string;
  subtypes?: string[];
  protocol?: 'tcp' | 'udp';
  txt?: Record<string, string>;
  probe?: boolean;
  disabledIpv6?: boolean;
};

export type BrowserOptions = {
  type?: string;
  subtypes?: string[];
  protocol?: string;
  txt?: Record<string, string>;
};

export type RemoteService = {
  name: string;
  fqdn: string;
  host: string;
  port: number;
  type: string;
  protocol: string;
  subtypes: string[];
  txt: Record<string, string>;
  referer: RemoteInfo;
  rawTxt: Buffer;
  addresses: string[];
};

type BonjourTransportOptions = Partial<BonjourService.ServiceConfig> & {
  interface?: string;
  bind?: string | false;
};

type Responder = {
  instance: BonjourService;
  address?: string;
};

type AdvertisementEvents = {
  up: [];
  error: [error: Error];
};

const restrictServiceAddress = (service: BonjourService.Service, address?: string): void => {
  if (!address) return;
  const records = service.records.bind(service);
  const restrictedService = service;
  restrictedService.records = () => selectBonjourAddressRecords(records(), address);
};

class CombinedAdvertisement extends EventEmitter<AdvertisementEvents> {
  readonly #advertisements: BonjourService.Service[];
  #announced = false;

  constructor(responders: Responder[], options: ServiceOptions) {
    super();
    this.#advertisements = responders.map(({ instance, address }) => {
      const advertisement = instance.publish({
        name: options.name,
        host: options.host,
        type: options.type,
        port: options.port,
        protocol: options.protocol,
        subtypes: options.subtypes,
        txt: options.txt,
        probe: address ? false : options.probe,
        disableIPv6: address ? true : options.disabledIpv6,
      });
      restrictServiceAddress(advertisement, address);
      advertisement.on('up', () => {
        if (this.#announced) return;
        this.#announced = true;
        this.emit('up');
      });
      advertisement.on('error', error => this.emit('error', error as Error));
      return advertisement;
    });
  }

  start(): void {
    this.#advertisements.forEach(advertisement => {
      advertisement.start();
    });
  }

  stop(callback?: () => void): void {
    let remaining = this.#advertisements.length;
    if (remaining === 0) {
      callback?.();
      return;
    }
    this.#advertisements.forEach(advertisement => {
      advertisement.stop(() => {
        remaining -= 1;
        if (remaining === 0) callback?.();
      });
    });
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }

  updateTxt(txt: Record<string, string>, silent?: boolean): void {
    void silent;
    this.#advertisements.forEach(advertisement => {
      const currentAdvertisement = advertisement;
      const restart = currentAdvertisement.published || currentAdvertisement.activated;
      const update = (): void => {
        currentAdvertisement.txt = txt;
        if (restart) currentAdvertisement.start();
      };
      if (restart) currentAdvertisement.stop(update);
      else update();
    });
  }
}

type BrowserEvents = {
  up: [service: RemoteService];
  down: [service: RemoteService];
  update: [service: RemoteService];
};

const normalizeRemoteService = (service: BonjourService.Service): RemoteService | undefined => {
  if (!service.referer) return undefined;
  return {
    name: service.name,
    fqdn: service.fqdn,
    host: service.host,
    port: service.port,
    type: service.type,
    protocol: service.protocol,
    subtypes: service.subtypes ?? [],
    txt: service.txt ?? {},
    referer: service.referer,
    rawTxt: Buffer.alloc(0),
    addresses: service.addresses ?? [],
  };
};

class CombinedBrowser extends EventEmitter<BrowserEvents> {
  readonly #browsers: BonjourService.Browser[];
  readonly #servicesByBrowser = new Map<BonjourService.Browser, Map<string, RemoteService>>();

  constructor(responders: Responder[], options: BrowserOptions) {
    super();
    this.#browsers = responders.map(({ instance }) => {
      const browser = instance.find({
        type: options.type ?? 'services',
        protocol: options.protocol as 'tcp' | 'udp' | undefined,
        subtypes: options.subtypes,
        txt: options.txt,
      });
      this.#servicesByBrowser.set(browser, new Map());
      browser.on('up', service => this.#remember(browser, service, 'up'));
      browser.on('txt-update', service => this.#remember(browser, service, 'update'));
      browser.on('srv-update', service => this.#remember(browser, service, 'update'));
      browser.on('down', service => this.#forget(browser, service));
      return browser;
    });
  }

  get services(): RemoteService[] {
    const services = new Map<string, RemoteService>();
    this.#servicesByBrowser.forEach(byName => {
      byName.forEach((service, fqdn) => services.set(fqdn, service));
    });
    return [...services.values()];
  }

  start(): void {
    this.#browsers.forEach(browser => browser.start());
  }

  stop(): void {
    this.#browsers.forEach(browser => browser.stop());
    this.#servicesByBrowser.clear();
  }

  update(): void {
    this.#browsers.forEach(browser => browser.update());
  }

  #remember(
    browser: BonjourService.Browser,
    discovered: BonjourService.Service,
    event: 'up' | 'update',
  ): void {
    const service = normalizeRemoteService(discovered);
    if (!service) return;
    const wasKnown = this.services.some(current => current.fqdn === service.fqdn);
    this.#servicesByBrowser.get(browser)?.set(service.fqdn, service);
    this.emit(wasKnown ? 'update' : event, service);
  }

  #forget(browser: BonjourService.Browser, discovered: BonjourService.Service): void {
    const service = normalizeRemoteService(discovered);
    if (!service) return;
    this.#servicesByBrowser.get(browser)?.delete(service.fqdn);
    const replacement = this.services.find(current => current.fqdn === service.fqdn);
    this.emit(replacement ? 'update' : 'down', replacement ?? service);
  }
}

const interfaces = getBonjourInterfaces();
const responders: Responder[] =
  interfaces.length > 0
    ? interfaces.map(address => ({
        instance: new BonjourService(
          { interface: address, bind: '0.0.0.0' } as BonjourTransportOptions,
          (error: Error) => debug(`mDNS error on ${address}: ${error.message}`),
        ),
        address,
      }))
    : [
        {
          instance: new BonjourService({}, (error: Error) => debug(`mDNS error: ${error.message}`)),
        },
      ];

const bonjour = {
  publish: (options: ServiceOptions) => new CombinedAdvertisement(responders, options),
  find: (options: BrowserOptions) => new CombinedBrowser(responders, options),
  destroy: (callback?: () => void) => {
    let remaining = responders.length;
    responders.forEach(({ instance }) => {
      instance.destroy(() => {
        remaining -= 1;
        if (remaining === 0) callback?.();
      });
    });
  },
};

app.once('will-quit', () => bonjour.destroy());

export default bonjour;
