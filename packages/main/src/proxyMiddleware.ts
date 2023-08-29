import { app, ipcMain } from 'electron';
import os from 'node:os';

import * as ciao from '@homebridge/ciao';
import debugFactory from 'debug';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { RequestHandler } from 'http-proxy-middleware';
import sortBy from 'lodash/sortBy';

import master, { isLocalhost } from './MasterBrowser';
import config, { port as currentPort } from './config';
import localConfig from './localConfig';
import { getMainWindow, waitWebContents } from './mainWindow';

import generateSignature from '/@common/generateSignature';
import Deferred from '/@common/Deferred';

import relaunch from './relaunch';
import { getOutgoingSecret } from './secret';

import bonjourHap from 'bonjour-hap';

type ProxyOptions = {
  readonly host: string;
  readonly port: number;
  readonly identifier: string;
  readonly rank: number;
};

type Proxy = RequestHandler &
  ProxyOptions & {
    secret(value: bigint): void;
  };

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:proxy`);

let masterProxy: Proxy | undefined;

const delay100 = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 100);
  });

const rank = Math.random();
const responder = ciao.getResponder();
const service = responder.createService({
  name: `Novastar Master Browser (${os.hostname().replace(/\.local\.?$/, '')})`,
  hostname: 'gmib.local',
  type: 'novastar',
  port: currentPort,
  txt: {
    rang: rank.toString(), // TODO: typo (backward compatibility), should be removed in the future.
    rank: rank.toString(),
    identifier: localConfig.get('identifier'),
    version: import.meta.env.VITE_APP_VERSION,
  },
});
service.on('name-change', name => {
  debug(`service name changed: ${name}`);
});

let timeout: NodeJS.Timeout | undefined;

const disableNet = config.get('disableNet');

const bonjour = bonjourHap();

const browser = bonjour.find({ type: 'novastar' }, () => {
  clearTimeout(timeout);
});

let isMaster = false;

let ready = new Deferred();

const selectStrongest = (
  remotes: bonjourHap.RemoteService[],
): bonjourHap.RemoteService | undefined =>
  sortBy(remotes, remote => -Number(remote.txt.rank ?? remote.txt.rang))[0];

const tryCreateMasterBrowser = () => {
  service
    .advertise()
    .then(delay100)
    .then(() => {
      const strongest = selectStrongest(browser.services);
      if (strongest && Number(strongest.txt.rank ?? strongest.txt.rang) > rank) {
        service.end();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        createProxy(strongest);
        isMaster = false;
        master.close();
        // debug(`close MBR: ${rank}`);
      } else {
        // debug(`MBR ${rank}`);
        isMaster = true;
        try {
          master.open();
          masterProxy = undefined;
        } catch (err) {
          debug(`error while master open: ${err}`);
        }
      }
      ready.resolve();
    });
};

if (!disableNet) {
  timeout = setTimeout(tryCreateMasterBrowser, 5000).unref();
} else {
  ready.resolve();
  isMaster = true;
}

config.onDidChange('disableNet', async (newValue, oldValue) => {
  if (oldValue != null && import.meta.env.PROD) {
    debug('relaunch...');
    responder.shutdown().finally(relaunch);
  }
});

const createProxy = (remote: bonjourHap.RemoteService) => {
  const host = remote.referer.address;
  const { port } = remote;
  const { identifier } = remote.txt;
  // const { host, port, identifier } = opts;
  const remoteTarget = `${host}:${port}`;
  let secret: Buffer | undefined;
  getOutgoingSecret(identifier).then(value => {
    secret = value;
  });
  const handler = createProxyMiddleware({
    target: `http://${remoteTarget}`,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
      if (secret) {
        const now = Date.now();
        proxyReq.setHeader('X-NI-Identifier', localConfig.get('identifier'));
        proxyReq.setHeader('X-NI-Timestamp', now.toString());
        proxyReq.setHeader(
          'X-NI-Signature',
          generateSignature(secret, req.method, req.url, now, req.body),
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
    onProxyRes: proxyRes => {
      // eslint-disable-next-line no-param-reassign
      proxyRes.headers['x-ni-identifier'] = identifier;
      // eslint-disable-next-line no-param-reassign
      proxyRes.headers['x-from'] = remoteTarget;
      // debug(`<<${req.method} ${req.url}`);
    },
    onError: (err: NodeJS.ErrnoException) => {
      debug(`proxy error: ${err}`);
      masterProxy = undefined;
      ready = new Deferred();
      browser.update();
      timeout = setTimeout(tryCreateMasterBrowser, 3000);
    },
  });
  masterProxy = Object.assign(handler, {
    host,
    port,
    identifier,
    rank: Number(remote.txt.rank),
    secret: (value: bigint) => {
      secret = Buffer.from(value.toString(16), 'hex');
    },
  });
  ready.resolve();
};

browser.on('up', async remote => {
  // debug(`UP ${remote.referer.address}`);
  waitWebContents().then(webContents =>
    setTimeout(() => webContents.send('reloadDevices'), 1000).unref(),
  );
  if (isLocalhost(remote.referer.address) || disableNet) return;
  const remoteRang = Number(remote.txt.rank);
  if (isMaster && remoteRang > rank) {
    await service.end();
    isMaster = false;
    await master.close();
    // debug(`close MBR: ${rank}`);
  }
  if (!isMaster && (!masterProxy || masterProxy.rank < remoteRang)) {
    createProxy(remote);
  }
});

browser.on('down', remote => {
  if (isMaster) return;

  if (browser.services.length === 0) {
    tryCreateMasterBrowser();
  } else if (masterProxy && remote.referer.address === masterProxy.host) {
    const strongest = selectStrongest(browser.services);
    if (strongest) {
      createProxy(strongest);
    } else {
      tryCreateMasterBrowser();
    }
  }
});

app.on('will-quit', () => {
  try {
    if (isMaster && master) master.close();
    service.destroy();
  } catch (err) {
    debug(`error while close: ${(err as Error).message}`);
  }
});

ipcMain.on('setRemoteSecret', (_, identifier: string, secret: bigint) => {
  if (masterProxy && masterProxy.identifier === identifier) masterProxy.secret(secret);
});

const middleware = express.Router();

middleware.use('/novastar', async (req, res, next) => {
  await ready.promise;
  if (masterProxy) masterProxy(req, res, next);
  else next();
});

export default middleware;
