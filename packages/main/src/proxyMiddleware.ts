import { app, ipcMain } from 'electron';
import { isIPv4 } from 'node:net';

import * as ciao from '@homebridge/ciao';
import debugFactory from 'debug';
import express from 'express';
import type { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { RequestHandler } from 'http-proxy-middleware';

import master, { isLocalhost } from './MasterBrowser';
import bonjour from './bonjour';
import config, { port as currentPort } from './config';
import localConfig from './localConfig';
import {
  compareMasterElectionPeers,
  type MasterElectionPeer,
  type MasterElectionRole,
  parseMasterElectionPeer,
  shouldYieldMasterRole,
} from './masterElection';
import { waitWebContents } from './mainWindow';
import { getGmibServiceHostname, getNovastarServiceName } from './serviceIdentity';

import generateSignature from '/@common/generateSignature';
import Deferred from '/@common/Deferred';

import relaunch from './relaunch';
import { getOutgoingSecret } from './secret';

import type bonjourHap from 'bonjour-hap';

type ProxyOptions = {
  readonly host: string;
  readonly port: number;
  readonly identifier: string;
  readonly rank: number;
};

type Proxy = RequestHandler<Request, Response> &
  ProxyOptions & {
    secret(value: bigint): void;
  };

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:proxy`);

let masterProxy: Proxy | undefined;

const MASTER_ELECTION_SETTLE_MS = 3000;
const MASTER_BROWSER_REFRESH_MS = 5000;

const delay = (timeout: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, timeout);
  });

const rank = Math.random();
const identifier = localConfig.get('identifier');
const commonServiceTxt = {
  candidateRank: rank.toString(),
  identifier,
  version: import.meta.env.VITE_APP_VERSION,
};
const candidateServiceTxt = {
  ...commonServiceTxt,
  role: 'candidate',
  // Older GMIB versions only understand rank/rang. A candidate must never displace their master.
  rang: '-1',
  rank: '-1',
};
const masterServiceTxt = {
  ...commonServiceTxt,
  role: 'master',
  rang: rank.toString(),
  rank: rank.toString(),
};
const responder = ciao.getResponder();
const service = responder.createService({
  name: getNovastarServiceName(identifier),
  hostname: getGmibServiceHostname(identifier),
  type: 'novastar',
  port: currentPort,
  txt: candidateServiceTxt,
});
service.on('name-change', name => {
  debug(`service name changed: ${name}`);
});

let timeout: NodeJS.Timeout | undefined;

const disableNet = config.get('disableNet');

let serviceActive = false;
let serviceRole: MasterElectionRole = 'candidate';

const stopMasterService = async (): Promise<void> => {
  if (!serviceActive) return;
  serviceActive = false;
  await service.end();
};

const advertiseMasterService = async (): Promise<void> => {
  serviceRole = 'candidate';
  service.updateTxt(candidateServiceTxt, true);
  await service.advertise();
  serviceActive = true;
};

const promoteMasterService = (): void => {
  serviceRole = 'master';
  service.updateTxt(masterServiceTxt);
};

const browser = bonjour.find({ type: 'novastar' });
const browserUpdateTimer = setInterval(() => browser.update(), MASTER_BROWSER_REFRESH_MS);
browserUpdateTimer.unref();

let isMaster = false;

let ready = new Deferred();

const getRemotePeer = (remote: bonjourHap.RemoteService): MasterElectionPeer =>
  parseMasterElectionPeer(remote.txt);

const getLocalPeer = (): MasterElectionPeer => ({ role: serviceRole, rank, identifier });

const getRemoteAddresses = (remote: bonjourHap.RemoteService): string[] =>
  [remote.referer.address, ...(remote.addresses ?? [])].filter(
    address => isIPv4(address) && !isLocalhost(address),
  );

const rememberRemoteGmib = (remote: bonjourHap.RemoteService): void => {
  master.registerGmibAddresses(remote.fqdn, getRemoteAddresses(remote));
};

const forgetRemoteGmib = (remote: bonjourHap.RemoteService): void => {
  master.unregisterGmibAddresses(remote.fqdn);
};

const selectStrongest = (
  remotes: bonjourHap.RemoteService[],
  role: MasterElectionRole = 'master',
): bonjourHap.RemoteService | undefined =>
  remotes
    .filter(remote => getRemotePeer(remote).role === role && !isLocalhost(remote.referer.address))
    .sort((left, right) =>
      compareMasterElectionPeers(getRemotePeer(right), getRemotePeer(left)),
    )[0];

let election: Promise<void> | undefined;

const tryCreateMasterBrowser = () => {
  if (election) return;
  browser.update();
  election = advertiseMasterService()
    .then(async () => {
      await delay(MASTER_ELECTION_SETTLE_MS);
    })
    .then(async () => {
      if (!serviceActive) return;
      const strongestMaster = selectStrongest(browser.services);
      const strongestCandidate = selectStrongest(browser.services, 'candidate');
      const strongest = strongestMaster ?? strongestCandidate;
      if (strongest && shouldYieldMasterRole(getLocalPeer(), getRemotePeer(strongest))) {
        debug(
          `yield to ${getRemotePeer(strongest).role} ${strongest.referer.address}:${strongest.port}`,
        );
        await stopMasterService();

        rememberRemoteGmib(strongest);
        if (getRemotePeer(strongest).role === 'master') createProxy(strongest);
        isMaster = false;
        await master.close();
        // debug(`close MBR: ${rank}`);
      } else {
        debug(`select local master ${rank}`);
        isMaster = true;
        promoteMasterService();
        try {
          master.open();
          masterProxy = undefined;
        } catch (err) {
          debug(`error while master open: ${err}`);
        }
        ready.resolve();
      }
    })
    .catch(err => {
      debug(`master election error: ${(err as Error).message}`);
      void stopMasterService();
    })
    .finally(() => {
      election = undefined;
    });
};

const retryMasterElection = (): void => {
  const currentElection = election;
  if (!currentElection) {
    tryCreateMasterBrowser();
    return;
  }
  void currentElection.finally(() => {
    if (!isMaster && !masterProxy && !selectStrongest(browser.services)) {
      tryCreateMasterBrowser();
    }
  });
};

if (!disableNet) {
  timeout = setTimeout(tryCreateMasterBrowser, 5000).unref();
} else {
  ready.resolve();
  isMaster = true;
}

config.onDidChange('disableNet', (_newValue, oldValue) => {
  if (oldValue != null && import.meta.env.PROD) {
    debug('relaunch...');
    void responder.shutdown().finally(relaunch);
  }
});

const createProxy = (remote: bonjourHap.RemoteService) => {
  rememberRemoteGmib(remote);
  const host = remote.referer.address;
  const { port } = remote;
  const { identifier } = remote.txt;
  // const { host, port, identifier } = opts;
  const remoteTarget = `${host}:${port}`;
  const remotePath = '/api/novastar';
  let secret: Buffer | undefined;
  void getOutgoingSecret(identifier).then(value => {
    secret = value;
  });
  const handler = createProxyMiddleware<Request, Response>({
    target: `http://${remoteTarget}${remotePath}`,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        if (secret) {
          const now = Date.now();
          proxyReq.setHeader('X-NI-Identifier', localConfig.get('identifier'));
          proxyReq.setHeader('X-NI-Timestamp', now.toString());
          proxyReq.setHeader(
            'X-NI-Signature',
            generateSignature(secret, req.method, `${remotePath}${req.url}`, now, req.body),
          );
        }
        proxyReq.removeHeader('authorization');
        /**
         * https://github.com/chimurai/http-proxy-middleware/issues/40#issuecomment-249430255
         */
        if (req.body) {
          const body = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
          proxyReq.write(body);
        }
      },
      proxyRes: proxyRes => {
        // eslint-disable-next-line no-param-reassign
        proxyRes.headers['x-ni-identifier'] = identifier;
        // eslint-disable-next-line no-param-reassign
        proxyRes.headers['x-from'] = remoteTarget;
        // debug(`<<${req.method} ${req.url}`);
      },
      error: (err: NodeJS.ErrnoException) => {
        debug(`proxy error: ${err}`);
        masterProxy = undefined;
        ready = new Deferred();
        browser.update();
        timeout = setTimeout(tryCreateMasterBrowser, 3000);
      },
    },
  });
  masterProxy = Object.assign(handler, {
    host,
    port,
    identifier,
    rank: getRemotePeer(remote).rank,
    secret: (value: bigint) => {
      secret = Buffer.from(value.toString(16), 'hex');
    },
  });
  ready.resolve();
};

const handleRemoteService = (remote: bonjourHap.RemoteService, updated = false): void => {
  void (async () => {
    const remotePeer = getRemotePeer(remote);
    debug(
      `master service ${updated ? 'update' : 'up'} ${remote.referer.address}:${remote.port} ` +
        `(${remotePeer.role})`,
    );
    rememberRemoteGmib(remote);
    if (!updated) {
      void waitWebContents().then(webContents =>
        setTimeout(() => webContents.send('reloadDevices'), 1000).unref(),
      );
    }
    if (isLocalhost(remote.referer.address) || disableNet) return;
    if (remotePeer.role === 'master') clearTimeout(timeout);
    if (serviceActive && shouldYieldMasterRole(getLocalPeer(), remotePeer)) {
      await stopMasterService();
      isMaster = false;
      await master.close();
      // debug(`close MBR: ${rank}`);
    }
    const currentProxyPeer: MasterElectionPeer | undefined = masterProxy && {
      role: 'master',
      rank: masterProxy.rank,
      identifier: masterProxy.identifier,
    };
    if (
      !isMaster &&
      remotePeer.role === 'master' &&
      (!currentProxyPeer || compareMasterElectionPeers(remotePeer, currentProxyPeer) > 0)
    ) {
      createProxy(remote);
    }
  })();
};

browser.on('up', remote => handleRemoteService(remote));
browser.on('update', remote => handleRemoteService(remote, true));

browser.on('down', remote => {
  debug(`master service down ${remote.referer.address}:${remote.port}`);
  forgetRemoteGmib(remote);
  if (isMaster) return;

  if (masterProxy && remote.referer.address === masterProxy.host) {
    const strongest = selectStrongest(browser.services);
    if (strongest) {
      createProxy(strongest);
    } else {
      retryMasterElection();
    }
  } else if (!masterProxy && !selectStrongest(browser.services)) {
    retryMasterElection();
  }
});

let isClosing = false;

app.on('before-quit', () => {
  if (isClosing) return;
  isClosing = true;
  clearInterval(browserUpdateTimer);
  try {
    void master.close();
    serviceActive = false;
    void service.destroy().catch(err => {
      debug(`error while destroy service: ${(err as Error).message}`);
    });
  } catch (err) {
    debug(`error while close: ${(err as Error).message}`);
  }
});

ipcMain.on('setRemoteSecret', (_, identifier: string, secret: bigint | null) => {
  if (masterProxy && masterProxy.identifier === identifier && secret) masterProxy.secret(secret);
});

const middleware = express.Router();

middleware.use('/novastar', async (req, res, next) => {
  await ready.promise;
  if (masterProxy) void masterProxy(req, res, next);
  else next();
});

export default middleware;
