import { app } from 'electron';
import { isIPv4 } from 'net';
import os from 'os';

import debugFactory from 'debug';

import type { RemoteHost } from '/@common/helpers';
import { notEmpty } from '/@common/helpers';

import localConfig from './localConfig';
import bonjour, { type RemoteService } from './bonjour';
import { getMainWindow, waitWebContents } from './mainWindow';
import master from './MasterBrowser';
import { areSameRemoteHost } from './remoteHost';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mdns`);

const mdnsBrowser = bonjour.find({ type: 'nibus' });

let updateTimer: NodeJS.Timeout | undefined;

const remoteHosts = new Map<string, RemoteHost>();

const remoteServiceChangeListeners = new Set<() => void>();

const emitRemoteServicesChanged = (): void => {
  remoteServiceChangeListeners.forEach(listener => listener());
};

export const onRemoteServicesChanged = (listener: () => void): (() => void) => {
  remoteServiceChangeListeners.add(listener);
  if (remoteHosts.size > 0) setImmediate(listener);
  return () => remoteServiceChangeListeners.delete(listener);
};

export const getRemoteHosts = (): RemoteHost[] => [...remoteHosts.values()];

const getLocalAddresses = (): string[] =>
  Object.values(os.networkInterfaces())
    .filter(notEmpty)
    .flat()
    .map(({ address }) => address);

const pickRemoteAddresses = (svc: RemoteService): string[] => {
  const localAddresses = getLocalAddresses();
  return Array.from(new Set([svc.referer.address, ...(svc.addresses ?? [])])).filter(
    address => !localAddresses.includes(address) && isIPv4(address),
  );
};

const rememberGmibService = (svc: RemoteService): void => {
  master.registerGmibAddresses(svc.fqdn, [svc.referer.address, ...pickRemoteAddresses(svc)]);
};

const forgetGmibService = (svc: RemoteService): void => {
  master.unregisterGmibAddresses(svc.fqdn);
};

export const pickRemoteService = (svc: RemoteService): RemoteHost | undefined => {
  const addresses = pickRemoteAddresses(svc);
  if (addresses.length === 0) return undefined;
  const { port, host, txt } = svc;
  const address = addresses.includes(svc.referer.address) ? svc.referer.address : addresses[0];
  return {
    name: (txt?.original ?? host).replace(/\.local\.?$/, ''),
    version: txt?.version ?? 'N/A',
    address,
    port,
    platform: txt?.platform,
    arch: txt?.arch,
    osVersion: txt?.osVersion ?? txt?.osversion,
  };
};

localConfig.onDidChange('hosts', () => {
  mdnsBrowser.update();
});

const serviceUp = (svc: RemoteService): void => {
  rememberGmibService(svc);
  const remote = pickRemoteService(svc);
  if (remote) {
    const previous = remoteHosts.get(svc.fqdn);
    remoteHosts.set(svc.fqdn, remote);
    getMainWindow()?.webContents.send('serviceUp', remote);
    if (!previous || !areSameRemoteHost(previous, remote)) {
      debug(`serviceUp ${JSON.stringify(remote)}`);
    }
  }
  emitRemoteServicesChanged();
};

const serviceDown = (svc: RemoteService): void => {
  forgetGmibService(svc);
  remoteHosts.delete(svc.fqdn);
  const remote = pickRemoteService(svc);
  if (remote) {
    getMainWindow()?.webContents.send('serviceDown', remote);
    debug(`serviceDown ${JSON.stringify(remote)}`);
  }
  emitRemoteServicesChanged();
};

export const onRemoteServiceUpdate = (listener: (svc: RemoteService) => void): void => {
  mdnsBrowser.on('update', listener);
};

app.once('ready', () => {
  mdnsBrowser.on('up', serviceUp);
  onRemoteServiceUpdate(serviceUp);
  mdnsBrowser.on('down', serviceDown);
  mdnsBrowser.update();
  updateTimer = setInterval(() => mdnsBrowser.update(), 30000);
  updateTimer.unref();
  void waitWebContents().then(() => {
    mdnsBrowser.services.forEach(serviceUp);
  });
});

app.once('quit', () => {
  clearInterval(updateTimer);
  mdnsBrowser.stop();
});

export default mdnsBrowser;
