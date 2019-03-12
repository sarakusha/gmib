"use strict";

var _debug = _interopRequireDefault(require("debug"));

var _configstore = _interopRequireDefault(require("configstore"));

var _ipc = require("../ipc");

var _Server = require("../ipc/Server");

var _nibus = require("../nibus");

var _helper = require("../nibus/helper");

var _const = require("./const");

var _detector = _interopRequireDefault(require("./detector"));

var _package = _interopRequireDefault(require("../../package.json"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const conf = new _configstore.default(_package.default.name, {
  logLevel: 'none'
});

_debug.default.enable('nibus:detector,nibus.service');

const debug = (0, _debug.default)('nibus:service');

const noop = () => {};

if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('SIGINT', () => process.emit('SIGINT', 'SIGINT'));
}

const direction = dir => dir === _Server.Direction.in ? '<<<' : '>>>';

const decoderIn = new _nibus.NibusDecoder();
decoderIn.on('data', datagram => {
  debug(`${direction(_Server.Direction.in)} ${datagram.toString({
    pick: conf.get('pick'),
    omit: conf.get('omit')
  })}`);
});
const decoderOut = new _nibus.NibusDecoder();
decoderOut.on('data', datagram => {
  debug(`${direction(_Server.Direction.out)} ${datagram.toString({
    pick: conf.get('pick'),
    omit: conf.get('omit')
  })}`);
});
const loggers = {
  none: null,
  hex: (data, dir) => {
    debug(`${direction(dir)} ${(0, _helper.printBuffer)(data)}`);
  },
  nibus: (data, dir) => {
    switch (dir) {
      case _Server.Direction.in:
        decoderIn.write(data);
        break;

      case _Server.Direction.out:
        decoderOut.write(data);
        break;
    }
  }
};

class NibusService {
  constructor() {
    _defineProperty(this, "server", void 0);

    _defineProperty(this, "isStarted", false);

    _defineProperty(this, "connections", []);

    _defineProperty(this, "logLevelHandler", (client, logLevel, pickFields, omitFields) => {
      conf.set('logLevel', logLevel);
      conf.set('pick', pickFields);
      conf.set('omit', omitFields);
      this.updateLogger();
    });

    _defineProperty(this, "connectionHandler", socket => {
      const {
        server,
        connections
      } = this;
      server.send(socket, 'ports', connections.map(connection => connection.toJSON())).catch(err => {
        debug('<error>', err.stack);
      });
    });

    _defineProperty(this, "addHandler", portInfo => {
      const {
        category
      } = portInfo;
      const mibCategory = _detector.default.detection.mibCategories[category];

      if (mibCategory) {
        // debug('connection added', mibCategory);
        const connection = new _ipc.SerialTee(portInfo, mibCategory);
        connection.on('close', comName => this.removeHandler({
          comName
        }));
        this.connections.push(connection);
        this.server.broadcast('add', connection.toJSON()).catch(noop);
        this.updateLogger(connection); // this.find(connection);
      }
    });

    _defineProperty(this, "removeHandler", ({
      comName
    }) => {
      const index = this.connections.findIndex(({
        portInfo: {
          comName: port
        }
      }) => port === comName);

      if (index !== -1) {
        const [connection] = this.connections.splice(index, 1); // debug(`nibus-connection was closed ${connection.description.category}`);

        connection.close();
        this.server.broadcast('remove', connection.toJSON()).catch(noop);
      }
    });

    this.server = new _ipc.Server(_const.PATH);
    this.server.on('connection', this.connectionHandler);
    this.server.on('client:setLogLevel', this.logLevelHandler);
  }

  updateLogger(connection) {
    const logger = loggers[conf.get('logLevel')];
    const connections = connection ? [connection] : this.connections;
    connections.forEach(con => con.setLogger(logger));
  }

  start() {
    if (this.isStarted) return;
    this.isStarted = true;
    const {
      detection
    } = _detector.default;
    if (detection == null) throw new Error('detection is N/A');

    _detector.default.on('add', this.addHandler);

    _detector.default.on('remove', this.removeHandler);

    _detector.default.getPorts().catch(err => {
      console.error('error while get ports', err.stack);
    });

    _detector.default.start();

    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
    /**
     * @event NibusService#start
     */

    debug('started');
  }

  stop() {
    if (!this.isStarted) return;
    const connections = this.connections.splice(0, this.connections.length);

    if (connections.length) {
      // Хак, нужен чтобы успеть закрыть все соединения, иначе не успевает их закрыть и выходит
      setTimeout(() => {
        connections.forEach(connection => connection.close());
      }, 0);
    }

    _detector.default.removeListener('add', this.addHandler);

    _detector.default.removeListener('remove', this.removeHandler); // detector.stop();


    this.isStarted = false;
    debug('stopped');
  }

  get path() {
    return this.server.path;
  }

}

const service = new NibusService();
service.start();