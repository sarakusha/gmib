import { app } from 'electron';
import { EventEmitter } from 'node:events';

import bonjourHap from 'bonjour-hap';

import { getBonjourInterfaces } from './bonjourInterface';
import { createSystemBonjour, isSystemBonjourAvailable } from './systemBonjour';

type Responder = {
  instance: bonjourHap.Bonjour;
  address?: string;
};

type AdvertisementEvents = {
  up: [];
  error: [error: Error];
};

class CombinedAdvertisement extends EventEmitter<AdvertisementEvents> {
  readonly #advertisements: bonjourHap.Service[];
  #announced = false;

  constructor(responders: Responder[], options: bonjourHap.ServiceOptions) {
    super();
    this.#advertisements = responders.map(({ instance, address }) => {
      const advertisement = instance.publish({
        ...options,
        probe: address ? false : options.probe,
        restrictedAddresses: address ? [address] : options.restrictedAddresses,
        disabledIpv6: address ? true : options.disabledIpv6,
      });
      advertisement.on('up', () => {
        if (this.#announced) return;
        this.#announced = true;
        this.emit('up');
      });
      advertisement.on('error', error => this.emit('error', error));
      return advertisement;
    });
  }

  start(): void {
    this.#advertisements.forEach(advertisement => advertisement.start());
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
    this.#advertisements.forEach(advertisement => advertisement.destroy());
    this.removeAllListeners();
  }

  updateTxt(txt: Record<string, string>, silent?: boolean): void {
    this.#advertisements.forEach(advertisement => advertisement.updateTxt(txt, silent));
  }
}

type BrowserEvents = {
  up: [service: bonjourHap.RemoteService];
  down: [service: bonjourHap.RemoteService];
  update: [service: bonjourHap.RemoteService];
};

class CombinedBrowser extends EventEmitter<BrowserEvents> {
  readonly #browsers: bonjourHap.Browser[];
  readonly #servicesByBrowser = new Map<
    bonjourHap.Browser,
    Map<string, bonjourHap.RemoteService>
  >();

  constructor(responders: Responder[], options: bonjourHap.BrowserOptions) {
    super();
    this.#browsers = responders.map(({ instance }) => {
      const browser = instance.find(options);
      this.#servicesByBrowser.set(browser, new Map());
      browser.on('up', service => this.#remember(browser, service, 'up'));
      browser.on('update', service => this.#remember(browser, service, 'update'));
      browser.on('down', service => this.#forget(browser, service));
      return browser;
    });
  }

  get services(): bonjourHap.RemoteService[] {
    const services = new Map<string, bonjourHap.RemoteService>();
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
    browser: bonjourHap.Browser,
    service: bonjourHap.RemoteService,
    event: 'up' | 'update',
  ): void {
    const wasKnown = this.services.some(current => current.fqdn === service.fqdn);
    this.#servicesByBrowser.get(browser)?.set(service.fqdn, service);
    this.emit(wasKnown ? 'update' : event, service);
  }

  #forget(browser: bonjourHap.Browser, service: bonjourHap.RemoteService): void {
    this.#servicesByBrowser.get(browser)?.delete(service.fqdn);
    const replacement = this.services.find(current => current.fqdn === service.fqdn);
    this.emit(replacement ? 'update' : 'down', replacement ?? service);
  }
}

const createEmbeddedBonjour = () => {
  const interfaces = getBonjourInterfaces();
  const responders: Responder[] =
    interfaces.length > 0
      ? interfaces.map(address => ({
          instance: bonjourHap({ interface: address, bind: '0.0.0.0' }),
          address,
        }))
      : [{ instance: bonjourHap() }];
  return {
    publish: (options: bonjourHap.ServiceOptions) => new CombinedAdvertisement(responders, options),
    find: (options: bonjourHap.BrowserOptions) => new CombinedBrowser(responders, options),
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
};

const bonjour = isSystemBonjourAvailable() ? createSystemBonjour() : createEmbeddedBonjour();

app.once('will-quit', () => bonjour.destroy());

export default bonjour;
