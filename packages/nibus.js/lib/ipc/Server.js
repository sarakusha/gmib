"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Direction = void 0;

var _net = _interopRequireWildcard(require("net"));

var _stream = require("stream");

var _debug = _interopRequireDefault(require("debug"));

var _fs = _interopRequireDefault(require("fs"));

var _xpipe = _interopRequireDefault(require("xpipe"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:IPCServer');

const noop = () => {};

let Direction;
exports.Direction = Direction;

(function (Direction) {
  Direction[Direction["in"] = 0] = "in";
  Direction[Direction["out"] = 1] = "out";
})(Direction || (exports.Direction = Direction = {}));

class IPCServer extends _stream.Duplex {
  constructor(_path, raw = false) {
    super();
    this.raw = raw;

    _defineProperty(this, "server", void 0);

    _defineProperty(this, "clients", void 0);

    _defineProperty(this, "closed", false);

    _defineProperty(this, "reading", false);

    _defineProperty(this, "connectionHandler", socket => {
      this.emit('connection', socket);
      this.clients.push(socket);
      socket.once('error', this.clientErrorHandler.bind(this, socket)).on('data', this.clientDataHandler.bind(this, socket)).once('close', () => this.removeClient(socket));
      debug('new connection on', this.path, this.clients.length);
    });

    _defineProperty(this, "errorHandler", err => {
      if (err.code === 'EADDRINUSE') {
        const check = _net.default.connect(_xpipe.default.eq(this.path), () => {
          debug('Server running, giving up...');
          process.exit();
        });

        check.once('error', e => {
          if (e.code === 'ECONNREFUSED') {
            _fs.default.unlinkSync(_xpipe.default.eq(this.path));

            this.server.listen(_xpipe.default.eq(this.path), () => {
              debug('restart', this.server.address());
            });
          }
        });
      } else {
        throw err;
      }
    });

    _defineProperty(this, "close", () => {
      if (this.closed) return;
      const path = this.server.address();
      this.clients.forEach(client => client.destroy());
      this.clients.length = 0;
      this.server.close();
      this.raw && this.push(null);
      this.closed = true;
      debug(`${path} closed`);
    });

    this.clients = [];
    this.server = new _net.Server();
    this.server = _net.default.createServer(this.connectionHandler).on('error', this.errorHandler).on('close', this.close).listen(_xpipe.default.eq(_path), () => {
      debug('listening on', this.server.address());
    });
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  clientErrorHandler(client, err) {
    debug('error on client', err.message);
    this.emit('client:error', client, err);
    this.removeClient(client);
  }

  clientDataHandler(client, data) {
    // if (this.raie) {
    //   debug(this.path, printBuffer(data));
    // }
    if (this.reading) {
      this.reading = this.push(data);
    }

    if (this.raw) {
      return this.emit('raw', data, Direction.in);
    }

    debug('data from', client.remoteAddress, data.toString());
    const {
      event,
      args
    } = JSON.parse(data.toString());
    this.emit(`client:${event}`, client, ...args);
  }

  removeClient(client) {
    const index = this.clients.findIndex(item => item === client);

    if (index !== -1) {
      this.clients.splice(index, 1);
    }

    client.destroy();
    debug('destroy connection on', this.path, this.clients.length);
  } // tslint:disable-next-line:function-name


  _write(chunk, encoding, callback) {
    this.emit('raw', chunk, Direction.out);
    this.clients.forEach(client => client.write(chunk, encoding, noop));
    callback();
  } // tslint:disable-next-line:function-name


  _read(size) {
    this.reading = true;
  }

  get path() {
    return (this.server.address() || '').toString();
  }

  send(client, event, ...args) {
    if (this.closed) {
      return Promise.reject(new Error('Server is closed'));
    }

    const data = {
      event,
      args
    };
    return new Promise(resolve => client.write(JSON.stringify(data), () => resolve()));
  }

  broadcast(event, ...args) {
    return Promise.all(this.clients.map(client => this.send(client, event, ...args))).then(() => {});
  }

}

var _default = IPCServer;
exports.default = _default;