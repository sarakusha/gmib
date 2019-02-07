import { Server } from 'http';
import express from 'express';
import next from 'next';
import socketIo from 'socket.io';
import getConfig from 'next/config';
import Configstore from 'configstore';
import debugFactory from 'debug';
// import { keys } from 'ts-transformer-keys';
// import { StelaProps } from '../pages/_app';
import { pick } from 'lodash';
import { PriceItem } from '../src/stela';
import timeid from '../src/timeid';

const pkgName = 'stela'; // require('../package.json').name;
const debug = debugFactory(pkgName);
const app = express();
const server = new Server(app);
const io = socketIo(server);
const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();
const { serverRuntimeConfig } = getConfig();
const store = new Configstore(pkgName, serverRuntimeConfig.bekar);

function checkAndUpdateID() {
  const items: PriceItem[] = store.get('items');
  const ids = {};
  store.set('items', items.map((item) => {
    while (!item.id || ids[item.id]) {
      item.id = timeid();
    }
    try {
      // @ts-ignore
      item.price = parseFloat(item.price);
    } catch (e) {
      item.price = 0;
      console.error('invalid value in item.price', e.message);
    }
    ids[item.id] = true;
    return item;
  }));
}

checkAndUpdateID();

console.log(`configuration file is ${store.path}`);
io.on('connection', (socket) => {
  debug('socket has connected');
  socket.emit('initial', store.all);
  socket.on('disconnected', () => {
    debug('socket has disconnected');
  });

  socket.on('update', (props) => {
    // const update = pick(props, PROPS);
    const update = props;
    store.set(update);
    checkAndUpdateID();
    io.emit('changed', pick(store.all, Object.keys(update)));
    debug('update', JSON.stringify(props));
  });

  // socket.on('updateItem', (item) => {
  //   const items = store.get('items');
  //   const index = _.findIndex(items, { id: item.id });
  //   if (index === -1) {
  //     debug(`WARN: item ${item.id} not found`);
  //     return;
  //   }
  //   items[index] = item;
  //   store.set('items', items);
  //   io.emit('update', { items });
  //   debug('updateItem', JSON.stringify(item));
  // });
  //
  // socket.on('removeItem', ({ id }) => {
  //   const items = store.get('items');
  //   const index = _.findIndex(items, { id });
  //   if (index === -1) {
  //     debug(`WARN: item ${id} not found`);
  //     return;
  //   }
  //   items.splice(index, 1);
  //   store.set('items', items);
  //   io.emit('update', { items });
  //   debug('removeItem', id);
  // });
  //
  // socket.on('addItem', (index?: number) => {
  //   const items = store.get('items');
  //   const item = { id: uniqid() };
  //   if (index === undefined || index >= items.length) {
  //     items.push(item);
  //   } else {
  //     items.splice(Math.max(0, index), 0, items);
  //   }
  //   store.set('items', items);
  //   io.emit('update', { items });
  //   debug('addItem', index);
  // });
});

nextApp.prepare().then(() => {
  app.get('/', (req, res) => {
    return nextApp.render(req, res, '/', store.all);
  });

  app.get('/dashboard', (res, req) => {
    return nextApp.render(res, req, '/dashboard', store.all);
  });

  app.get('*', (req, res) => nextHandler(req, res));

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
