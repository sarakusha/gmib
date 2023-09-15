import { app } from 'electron';
import { isIPv4 } from 'net';
import os from 'os';

import debugFactory from 'debug';

import type { RemoteHost } from '/@common/helpers';
import { notEmpty } from '/@common/helpers';

import localConfig from './localConfig';
import { getMainWindow, waitWebContents } from './mainWindow';

import bonjourHap from 'bonjour-hap';
import type { RemoteService } from 'bonjour-hap';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mdns`);

const bonjour = bonjourHap();

const mdnsBrowser = bonjour.find({ type: 'nibus' });

const interfaces = Object.values(os.networkInterfaces()).filter(notEmpty);

const localAddresses = ([] as os.NetworkInterfaceInfo[])
  .concat(...interfaces)
  .map(({ address }) => address);

export const pickRemoteService = (svc: RemoteService): RemoteHost | undefined => {
  if (!svc.addresses) {
    return undefined;
  }
  const addresses = svc.addresses.filter(
    address => !localAddresses.includes(address) && isIPv4(address),
  );
  if (addresses.length === 0) return undefined;
  const { port, host, txt } = svc;
  return {
    name: (txt.original ?? host).replace(/\.local\.?$/, ''),
    version: txt.version ?? 'N/A',
    address: svc.referer.address ?? addresses[0],
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
  const remote = pickRemoteService(svc);
  if (remote) {
    getMainWindow()?.webContents.send('serviceUp', remote);
    debug(`serviceUp ${JSON.stringify(remote)}`);
  }
};

const serviceDown = (svc: RemoteService): void => {
  const remote = pickRemoteService(svc);
  if (remote) {
    getMainWindow()?.webContents.send('serviceDown', remote);
    debug(`serviceDown ${JSON.stringify(remote)}`);
  }
};

app.once('ready', () => {
  mdnsBrowser.on('up', serviceUp);
  mdnsBrowser.on('down', serviceDown);
  waitWebContents().then(() => {
    mdnsBrowser.services.forEach(serviceUp);
  });
});

app.once('quit', () => {
  mdnsBrowser.stop();
  bonjour.destroy();
});

export default mdnsBrowser;
