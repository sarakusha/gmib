import { app } from 'electron';
import { isIPv4 } from 'net';
import os from 'os';

import debugFactory from 'debug';

import type { RemoteHost } from '/@common/helpers';
import { notEmpty } from '/@common/helpers';

import localConfig from './localConfig';
// import { removeRemote } from './mainMenu';
// import { addRemote, getMainWindow, setRemotes } from './mainWindow';

import bonjourHap from 'bonjour-hap';
import type { RemoteService } from 'bonjour-hap';
import { getMainWindow, waitWebContents } from './mainWindow';

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

// const register = (svc: RemoteService): void => {
//   const remote = pickRemoteService(svc);
//   if (remote) {
//     debug(`serviceUp ${JSON.stringify(remote)}}`);
//     getMainWindow()?.webContents.send('serviceUp', remote);
//     // eslint-disable-next-line @typescript-eslint/no-use-before-define
//     // addRemote(remote.port, remote.address);
//   }
// };

// const updateRemotes = (hosts: CustomHost[] | undefined): void => {
//   // debug(`hosts: ${JSON.stringify(hosts)}`);
//   const remotes: CustomHost[] = uniqBy(
//     [...mdnsBrowser.services.map(pickRemoteService).filter(notEmpty), ...(hosts ?? [])],
//     ({ port, address }) => getRemoteLabel(port, address),
//   );
//   // debug(`remotes: ${JSON.stringify(remotes)}`);
//   setRemotes(remotes);
// };

localConfig.onDidChange('hosts', hosts => {
  // updateRemotes(hosts);
  mdnsBrowser.update();
});

// const isCustomHost = (remote: RemoteHost): boolean => {
//   const label = getRemoteLabel(remote.port, remote.address);
//   const customHosts = localConfig.get('hosts');
//   const custom = customHosts.find(({ port, address }) => getRemoteLabel(port, address) === label);
//   return Boolean(custom);
// };

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
