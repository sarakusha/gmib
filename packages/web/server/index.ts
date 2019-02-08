import { Server } from 'http';
import express from 'express';
import next from 'next';
import socketIo from 'socket.io';
import debugFactory from 'debug';
import { pick } from 'lodash';
import bodyParser from 'body-parser';
import session from 'express-session';
import memorystore from 'memorystore';
import users from '../src/users';
// import csrf from 'csurf';

import { passport } from '../src/auth';
import { PriceItem, PROPS } from '../src/stela';
import timeid from '../src/timeid';
import store, { pkgName } from '../src/store';

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const debug = debugFactory(pkgName);
const app = express();
const server = new Server(app);
const io = socketIo(server);
const port = parseInt(process.env.PORT, 10) || 3000;
const nextHandler = nextApp.getRequestHandler();
const MemoryStore = memorystore(session);
const maxAge = 60000 * 60 / 2; // prune expired entries every h
const sessionMiddleware = session({
  secret: 'secret',
  store: new MemoryStore({
    checkPeriod: maxAge,
  }),
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge,
    name: 'connect.sid',
    httpOnly: true,
    secure: 'auto',
  },
});

function checkAndUpdateID() {
  const items: PriceItem[] = store.get('items') || [];
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

// Wrap the session middleware
io.use(({ request }, next) => {
  sessionMiddleware(request, request.res, next);
});

io.on('connection', (socket) => {
  const session = (socket.handshake as any).session;
  // if (session) {
  //   session.socket = socket;
  //   session.save();
  // }
  // console.log('socket session', session);
  debug('socket has connected');
  // console.log('CONNECT SOCKET', socket.request.session);
  socket.emit('initial', store.all);
  socket.on('disconnected', () => {
    debug('socket has disconnected');
  });

  socket.on('reload', () => {
    // console.log('RELOAD');
    socket.request.session.reload(() => {});
  });
  socket.on('update', (props) => {
    const session = socket.request.session;
    // console.log('UPDATE SOCKET SESSION', session);
    const username = session && session.passport && session.passport.user;
    // console.log('USERNAME', username);
    if (!users.hasUser(username)) {
      socket.emit('logout');
      return;
    }
    // console.log('update socket session', session);
    const update = pick(props, PROPS);
    // const update = props;
    store.set(update);
    checkAndUpdateID();
    io.emit('changed', pick(store.all, Object.keys(update)));
    debug(`update by ${username}`, JSON.stringify(props));
  });
});

nextApp.prepare().then(() => {
  // let all requests to /_next/* pass to it *before*
  // Express Session and other middleware is called.
  app.all('/_next/*', (req, res) => nextHandler(req, res));
  app.use(bodyParser.json());
  app.use(sessionMiddleware);

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/', (req, res) => {
    return nextApp.render(req, res, '/', store.all);
  });

  app.get('/dashboard', (res, req) => {
    return nextApp.render(res, req, '/dashboard', store.all);
  });

  app.post(
    '/login', // wrap passport.authenticate call in a middleware function
    passport.authenticate('local'),
    // (req, res, next) => {
    //   // call passport authentication passing the "local" strategy name and a callback function
    //   passport.authenticate('local', (error, user, info) => {
    //     // console.log(req.body);
    //     // this will execute in any case, even if a passport strategy will find an error
    //     // log everything to console
    //     console.log(error);
    //     console.log(user);
    //     console.log(info);
    //
    //     if (error) {
    //       res.status(401).send(error);
    //     } else if (!user) {
    //       res.status(401).send(info);
    //     } else {
    //       next();
    //     }
    //
    //     // res.status(401).send(info);
    //   })(req, res);
    // },
    (req, res) => {
      const session = (req as any).session;
      // console.log('CURRENT SESSION', session);
      res.send(session);
      // io.emit('')
    },
  );

  app.get('/logout', (req, res) => {
    req.logout();
    res.end();
  });

  app.get('*', (req, res) => nextHandler(req, res));

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
