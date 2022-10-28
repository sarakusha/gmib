import { app } from 'electron';
import fs from 'fs';

import service from '@nibus/cli';
import debugFactory from 'debug';
import log from 'electron-log';
import { Tail } from 'tail';
import tcpPortUsed from 'tcp-port-used';

import config from './config';
import getAllDisplays from './getAllDisplays';
import { getBrightnessHistoryOn } from './history';
import localConfig from './localConfig';
import Reader from './reader';
import secret from './secret';

// import { updateScreens } from './updateScreens';

const reader = new Reader(200);

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:nibus`);

export default { service } as const;

const closeNibus = (): void => {
  if (!service) return;
  try {
    service.stop();
    // service = undefined;
  } catch (e) {
    debug(`error while close nibus: ${(e as Error).message}`);
  }
};

(async function startLocalNibus(): Promise<void> {
  const inUse = await tcpPortUsed.check(+(process.env['NIBUS_PORT'] ?? 9001));
  if (inUse) {
    debug('Port already in use');
    return;
  }
  // const { default: svc } = await import('@nibus/cli/service');
  // service = svc;
  service.server.on('connection', socket => {
    const file = log.transports.file.getFile().path;
    if (fs.existsSync(file)) {
      setTimeout(() => {
        reader
          .read(file)
          .then(lines => lines.forEach(line => service.server.send(socket, 'log', line)));
      }, 3000);
    }
    service?.server.send(socket, 'config', config.store);
    service?.server.send(socket, 'displays', getAllDisplays());
  });
  service.server.on('client:config', (socket, store) => {
    try {
      config.store = store as typeof config.store;
      service.server.broadcast('config', config.store);
    } catch (err) {
      debug(`Error while save config: ${(err as Error).message}`, true);
      service.server.send(socket, 'config', config.store);
    }
  });
  service.server.on('client:getBrightnessHistory', (socket, dt) => {
    if (dt != null)
      getBrightnessHistoryOn(dt).then(rows =>
        service.server.send(socket, 'brightnessHistory', rows),
      );
  });
  debug('Starting local NIBUS...');
  await service.start(secret.toString('base64'));
  // sendStatusToWindow(`NiBUS started. Detection file: ${detectionPath}`);
})().catch(e => {
  debug(`Error while nibus starting: ${(e as Error).stack}`);
});

let lastHealth: number | undefined;

localConfig.onDidChange('health', health => {
  if (health && health.timestamp !== lastHealth) {
    lastHealth = health.timestamp;
    service?.server.broadcast('health', health);
  }
});

const tail = new Tail(log.transports.file.getFile().path);
tail.on('line', line => service.server.broadcast('log', line));

// TODO: Screens
/*
app.once('ready', () => {
  const broadcastDisplays = (): void => {
    service?.server?.broadcast('displays', getAllDisplays());
    setTimeout(() => {
      const screens = config.get('screens');
      updateScreens(screens, screens);
    }, 3000).unref();
  };

  screen.on('display-added', broadcastDisplays);
  screen.on('display-removed', broadcastDisplays);
});
*/

app.once('quit', closeNibus);
