import { app, ipcMain } from 'electron';

import ciao from '@homebridge/ciao';
import debugFactory from 'debug';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { RequestHandler } from 'http-proxy-middleware';
import sortBy from 'lodash/sortBy';

import master from './MasterBrowser';
import { port as currentPort } from './config';
import localConfig from './localConfig';
import { getOutgoingSecret } from './secret';

import bonjourHap from 'bonjour-hap';

import generateSignature from '/@common/generateSignature';
import Deferred from '/@common/Deferred';

type ProxyOptions = {
  readonly host: string;
  readonly port: number;
  readonly identifier: string;
  readonly rang: number;
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

const rang = Math.random();
const responder = ciao.getResponder();
const service = responder.createService({
  name: 'Novastar Master Browser',
  type: 'novastar',
  port: currentPort,
  txt: {
    rang: rang.toString(),
    identifier: localConfig.get('identifier'),
  },
});

let timeout: NodeJS.Timeout | undefined;

const bonjour = bonjourHap();

const browser = bonjour.find({ type: 'novastar' }, () => {
  clearTimeout(timeout);
});

const isLocalhost = (address: string) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0'].includes(address);

let isMaster = false;

let ready = new Deferred();

const selectStrongest = (
  remotes: bonjourHap.RemoteService[],
): bonjourHap.RemoteService | undefined => sortBy(remotes, remote => -Number(remote.txt.rang))[0];

const tryCreateMasterBrowser = () => {
  service
    .advertise()
    .then(delay100)
    .then(() => {
      const strongest = selectStrongest(browser.services);
      if (strongest && Number(strongest.txt.rang) > rang) {
        service.end();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        createProxy(strongest);
        isMaster = false;
        master.close();
        debug(`close MBR: ${rang}`);
      } else {
        debug(`MBR ${rang}`);
        isMaster = true;
        master.open();
        masterProxy = undefined;
      }
      ready.resolve();
    });
};

timeout = setTimeout(tryCreateMasterBrowser, 3000).unref();

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
    rang: Number(remote.txt.rang),
    secret: (value: bigint) => {
      secret = Buffer.from(value.toString(16), 'hex');
    },
  });
  ready.resolve();
};

browser.on('up', remote => {
  if (isLocalhost(remote.referer.address)) return;
  const remoteRang = Number(remote.txt.rang);
  if (isMaster && remoteRang > rang) {
    service.end();
    isMaster = false;
    await master.close();
    // debug(`close MBR: ${rang}`);
  }
  if (!isMaster && (!masterProxy || masterProxy.rang < remoteRang)) {
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

app.on('before-quit', () => {
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
