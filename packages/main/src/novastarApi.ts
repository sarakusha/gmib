import { app } from 'electron';

// import debugFactory from 'debug';
import express from 'express';
import type { RequestHandler } from 'express-serve-static-core';

import type { ScreenId } from '/@common/novastar';
import type { FilterNames } from '/@common/helpers';

import master from './MasterBrowser';

const api = express.Router();

// const events = [
//   'add',
//   'change',
//   'illuminance',
//   'remove',
//   'screen',
//   'update',
//   'cabinet',
//   'telemetry',
//   'broadcastDetected',
// ] as const;

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:novastarApi`);

// api.use((req, res, next) => {
//   debug(`${req.method} ${req.url}`);
//   next();
// });
// api.use('/subscribe', (req, res) => {
//   res.writeHead(200, {
//     Connection: 'keep-alive',
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     'access-control-allow-origin': '*',
//   });
//   res.flushHeaders();
//   const makeHandler = memoize((event: string) => (...args: unknown[]) => {
//     if (res.writable) {
//       // debug(`EVENT: ${event}: ${JSON.stringify(args)} ${req.hostname}`);
//       res.write(`event: ${event}
// data: ${JSON.stringify(args)}

// `);
//     }
//   });
//   events.forEach(event => master.on(event, makeHandler(event)));
//   const close = () => {
//     app.off('will-quit', close);
//     res.end();
//     events.forEach(event => master.off(event, makeHandler.cache.get(event)));
//     // debug(`unsubscribe: ${req.ip}`);
//   };
//   master.on('close', close);
//   req.socket.once('close', close);
//   app.once('will-quit', close);
// });

api.get('/', async (req, res) => {
  const all = await master.getAll();
  res.json(all);
});

api.post('/reload', async (req, res) => {
  const { path } = req.body;
  try {
    await master.reload(path);
  } catch (e) {
    // debug(`error: ${e}`);
  }
  res.end();
  // const device = await master.getNovastar(path);
  // if (!device) res.sendStatus(404);
  // else res.json(device);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Methods = FilterNames<typeof master, (arg: ScreenId, value: any) => Promise<void>>;

const makeHandler =
  <K extends Methods>(method: K, defaultScreen = 0): RequestHandler =>
  async (req, res) => {
    try {
      const { path, screen = defaultScreen, value } = req.body;
      // debug(`${method} ${path}[${screen}] = ${value}`);
      await master[method]({ path, screen }, value);
      res.end();
      // debug('Ok');
    } catch (e) {
      // debug(`error: ${e}`);
      res.status(500).send((e as Error).message);
    }
  };

api.put('/screens/mode', makeHandler('setDisplayMode'));
api.put('/screens/gamma', makeHandler('setGamma'));
api.put('/screens/rgbv', makeHandler('setRGBVBrightness'));
api.put('/screens/brightness', makeHandler('setBrightness', -1));
api.post('/serial', async (req, res) => {
  // debug(`from: ${req.ip}`);
  const { path, port } = req.body;
  const host = req.ip.replace(/^(::ffff:)/, '');
  // debug(JSON.stringify(req.headers));
  master.createSerialConnection(path, port, host).then(
    () => res.end(),
    err => res.status(500).json({ error: (err as Error).message }),
  );
});

api.post('/telemetry/start', (req, res) => {
  const { path, selectors } = req.body;
  const telemetry = master.telemetry(path);
  if (!telemetry) {
    res.sendStatus(404);
  } else {
    telemetry.start({ selectors: new Set(selectors) });
    res.end();
  }
});

api.post('/telemetry/cancel', (req, res) => {
  const { path } = req.body;
  const telemetry = master.telemetry(path);
  if (!telemetry) {
    res.sendStatus(404);
  } else {
    telemetry.cancel();
    res.end();
  }
});

export default api;
