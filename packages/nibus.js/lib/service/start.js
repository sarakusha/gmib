"use strict";

var _debug = _interopRequireDefault(require("debug"));

var _ipc = require("../ipc");

var _detector = _interopRequireDefault(require("./detector"));

var _const = require("./const");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:service');

const noop = () => {};

class NibusService {
  constructor() {
    _defineProperty(this, "server", void 0);

    _defineProperty(this, "isStarted", false);

    _defineProperty(this, "connections", []);

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
        this.server.broadcast('add', connection.toJSON()).catch(noop); // this.find(connection);
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