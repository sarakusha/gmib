import { app } from 'electron';
import { isIPv4 } from 'net';
import os from 'os';

import debugFactory from 'debug';
import uniqBy from 'lodash/uniqBy';

import type { CustomHost, RemoteHost } from '/@common/helpers';
import { getRemoteLabel, notEmpty } from '/@common/helpers';

import localConfig, { getAnnounce } from './localConfig';
import { removeRemote } from './mainMenu';
import { addRemote, getMainWindow, setRemotes } from './mainWindow';

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
  const { port, name, host, txt } = svc;
  return {
    host: host.replace(/\.local\.?$/, ''),
    name,
    version: txt.version ?? 'N/A',
    address: svc.referer.address ?? addresses[0],
    port,
  };
};

const register = (svc: RemoteService): void => {
  const remote = pickRemoteService(svc);
  if (remote) {
    debug(`serviceUp ${JSON.stringify(remote)}}`);
    getMainWindow()?.webContents.send('serviceUp', remote);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    addRemote(remote.port, remote.address);
  }
};

const updateRemotes = (hosts: CustomHost[] | undefined): void => {
  // debug(`hosts: ${JSON.stringify(hosts)}`);
  const remotes: CustomHost[] = uniqBy(
    [...mdnsBrowser.services.map(pickRemoteService).filter(notEmpty), ...(hosts ?? [])],
    ({ port, address }) => getRemoteLabel(port, address),
  );
  // debug(`remotes: ${JSON.stringify(remotes)}`);
  setRemotes(remotes);
};

localConfig.onDidChange('hosts', hosts => {
  updateRemotes(hosts);
  mdnsBrowser.update();
});

const isCustomHost = (remote: RemoteHost): boolean => {
  const label = getRemoteLabel(remote.port, remote.address);
  const customHosts = localConfig.get('hosts');
  const custom = customHosts.find(({ port, address }) => getRemoteLabel(port, address) === label);
  return Boolean(custom);
};

app.once('ready', () => {
  mdnsBrowser.on('up', register);
  mdnsBrowser.on('down', svc => {
    const remote = pickRemoteService(svc);
    if (remote) {
      debug(`serviceDown ${JSON.stringify(remote)}`);
      getMainWindow()?.webContents.send('serviceDown', remote);
      if (!isCustomHost(remote)) {
        removeRemote(remote);
      }
    }
  });
  // Нужно немного подождать
  setTimeout(() => {
    debug(`register remotes: ${mdnsBrowser.services.length}`);
    mdnsBrowser.services.forEach(svc => register(svc));
    // getMainWindow()?.webContents.on('did-finish-load', async () => {
    //   const announce = await getAnnounce();
    //   if (
    //     announce &&
    //     typeof announce === 'object' &&
    //     'message' in announce &&
    //     typeof announce.message === 'string'
    //   ) {
    //     const { message, ...data } = announce;
    //     announceWindow(announce.message);
    //     const { default: store } = await import(import.meta.env.VITE_ANNOUNCE_STORE);
    //     Object.assign(store, data);
    //   }
    // });
  }, 100).unref();
  addRemote();
  updateRemotes(localConfig.get('hosts'));
});

app.once('quit', () => {
  mdnsBrowser.stop();
  bonjour.destroy();
});

export default mdnsBrowser;
