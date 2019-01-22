import { Server } from 'http';
import express from 'express';
import next from 'next';
import socketIo from 'socket.io';
import getConfig from 'next/config';
import Configstore from 'configstore';
import { keys } from 'ts-transformer-keys';
import { StelaState } from '../pages';
import { pick } from 'lodash';

const app = express();
const server = new Server(app);
const io = socketIo(server);
const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();
const { publicRuntimeConfig } = getConfig();
const store = new Configstore(require('../package.json').name, publicRuntimeConfig.bekar);

console.log(`configuration file is ${store.path}`);
io.on('connection', (socket) => {
  console.log('connected');
  socket.emit('initial', store.all);
  socket.on('disconnected', () => {
    console.log('disconnected');
  });
  socket.on('update', (props) => {
    const update = pick(props, keys<StelaState>());
    store.set(update);
    io.emit('changed', update);
    console.log('update', update);
  });
});

nextApp.prepare().then(() => {
  app.get('/', (req, res) => {
    return nextApp.render(req, res, '/', store.all);
  });

  app.get('*', (req, res) => nextHandler(req, res));

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
