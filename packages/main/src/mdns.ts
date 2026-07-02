import { app } from 'electron';
import { isIPv4 } from 'net';
import os from 'os';

import debugFactory from 'debug';

import type { RemoteHost } from '/@common/helpers';
import { notEmpty } from '/@common/helpers';

import localConfig from './localConfig';
import { getMainWindow, waitWebContents } from './mainWindow';
import master from './MasterBrowser';

import bonjourHap from 'bonjour-hap';
import type { RemoteService } from 'bonjour-hap';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mdns`);

const bonjour = bonjourHap();

const mdnsBrowser = bonjour.find({ type: 'nibus' });

let updateTimer: NodeJS.Timeout | undefined;

const getLocalAddresses = (): string[] =>
  Object.values(os.networkInterfaces())
    .filter(notEmpty)
    .flat()
    .map(({ address }) => address);

const pickRemoteAddresses = (svc: RemoteService): string[] => {
  const localAddresses = getLocalAddresses();
  return (svc.addresses ?? []).filter(
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
  if (!svc.addresses) {
    return undefined;
  }
  const addresses = pickRemoteAddresses(svc);
  if (addresses.length === 0) return undefined;
  const { port, host, txt } = svc;
  const address = addresses.includes(svc.referer.address) ? svc.referer.address : addresses[0];
  return {
    name: (txt.original ?? host).replace(/\.local\.?$/, ''),
    version: txt.version ?? 'N/A',
    address,
    port,
    platform: txt.platform,
    arch: txt.arch,
    osVersion: txt.osversion,
  };
};

localConfig.onDidChange('hosts', () => {
  mdnsBrowser.update();
});

const serviceUp = (svc: RemoteService): void => {
  rememberGmibService(svc);
  const remote = pickRemoteService(svc);
  if (remote) {
    getMainWindow()?.webContents.send('serviceUp', remote);
    debug(`serviceUp ${JSON.stringify(remote)}`);
  }
};

const serviceDown = (svc: RemoteService): void => {
  forgetGmibService(svc);
  const remote = pickRemoteService(svc);
  if (remote) {
    getMainWindow()?.webContents.send('serviceDown', remote);
    debug(`serviceDown ${JSON.stringify(remote)}`);
  }
};

app.once('ready', () => {
  mdnsBrowser.on('up', serviceUp);
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
  bonjour.destroy();
});

export default mdnsBrowser;
