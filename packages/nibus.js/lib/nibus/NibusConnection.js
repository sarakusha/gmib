"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.getNibusTimeout = exports.setNibusTimeout = exports.MINIHOST_TYPE = void 0;

var _PathReporter = require("io-ts/lib/PathReporter");

var _lodash = _interopRequireDefault(require("lodash"));

var _net = require("net");

var _xpipe = _interopRequireDefault(require("xpipe"));

var _events = require("events");

var _debug = _interopRequireDefault(require("debug"));

var _errors = require("../errors");

var _ipc = require("../ipc");

var _nms = require("../nms");

var _NmsServiceType = _interopRequireDefault(require("../nms/NmsServiceType"));

var _sarp = require("../sarp");

var _KnownPorts = require("../service/KnownPorts");

var _NibusEncoder = _interopRequireDefault(require("./NibusEncoder"));

var _NibusDecoder = _interopRequireDefault(require("./NibusDecoder"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const MINIHOST_TYPE = 0xabc6;
exports.MINIHOST_TYPE = MINIHOST_TYPE;
const FIRMWARE_VERSION_ID = 0x85;
const VERSION_ID = 2;
const debug = (0, _debug.default)('nibus:connection');
let NIBUS_TIMEOUT = 1000;

const setNibusTimeout = timeout => {
  NIBUS_TIMEOUT = timeout;
};

exports.setNibusTimeout = setNibusTimeout;

const getNibusTimeout = () => NIBUS_TIMEOUT;

exports.getNibusTimeout = getNibusTimeout;

class WaitedNmsDatagram {
  constructor(req, resolve, reject, callback) {
    this.req = req;

    _defineProperty(this, "resolve", void 0);

    let timer;
    let counter = req.service !== _NmsServiceType.default.Read ? 1 : Math.floor(req.nms.length / 3) + 1;
    const datagrams = [];

    const timeout = () => {
      callback(this);
      datagrams.length === 0 ? reject(new _errors.TimeoutError(`Timeout error on ${req.destination} while ${_NmsServiceType.default[req.service]}`)) : resolve(datagrams);
    };

    const restart = (step = 1) => {
      counter -= step;
      clearTimeout(timer);

      if (counter > 0) {
        timer = setTimeout(timeout, req.timeout || NIBUS_TIMEOUT);
      } else if (counter === 0) {
        callback(this);
      }

      return counter === 0;
    };

    restart(0);

    this.resolve = datagram => {
      datagrams.push(datagram);

      if (restart()) {
        resolve(datagrams.length > 1 ? datagrams : datagram);
      }
    };
  }

}

class NibusConnection extends _events.EventEmitter {
  constructor(path, _description) {
    super();
    this.path = path;

    _defineProperty(this, "socket", void 0);

    _defineProperty(this, "encoder", new _NibusEncoder.default());

    _defineProperty(this, "decoder", new _NibusDecoder.default());

    _defineProperty(this, "ready", Promise.resolve());

    _defineProperty(this, "closed", false);

    _defineProperty(this, "waited", []);

    _defineProperty(this, "description", void 0);

    _defineProperty(this, "stopWaiting", waited => _lodash.default.remove(this.waited, waited));

    _defineProperty(this, "onDatagram", datagram => {
      let showLog = true;

      if (datagram instanceof _nms.NmsDatagram) {
        if (datagram.isResponse) {
          const resp = this.waited.find(item => datagram.isResponseFor(item.req));

          if (resp) {
            resp.resolve(datagram);
            showLog = false;
          }
        }

        this.emit('nms', datagram);
      } else if (datagram instanceof _sarp.SarpDatagram) {
        this.emit('sarp', datagram);
        showLog = false;
      }

      showLog && debug(`datagram received`, JSON.stringify(datagram.toJSON()));
    });

    _defineProperty(this, "close", () => {
      if (this.closed) return;
      const {
        path,
        description
      } = this;
      debug(`close connection on ${path} (${description.category})`);
      this.closed = true;
      this.encoder.end();
      this.decoder.removeAllListeners('data');
      this.socket.destroy();
      this.emit('close');
    });

    const validate = _KnownPorts.MibDescriptionV.decode(_description);

    if (validate.isLeft()) {
      const msg = _PathReporter.PathReporter.report(validate).join('\n');

      debug('<error>', msg);
      throw new TypeError(msg);
    }

    this.description = validate.value;
    this.socket = (0, _net.connect)(_xpipe.default.eq(_ipc.SerialTee.getSocketPath(path)));
    this.socket.pipe(this.decoder);
    this.encoder.pipe(this.socket);
    this.decoder.on('data', this.onDatagram);
    this.socket.once('close', this.close);
    debug(`new connection on ${path} (${_description.category})`);
  }

  sendDatagram(datagram) {
    // debug('write datagram from ', datagram.source.toString());
    const {
      encoder,
      stopWaiting,
      waited,
      closed
    } = this;
    return new Promise((resolve, reject) => {
      this.ready = this.ready.finally(async () => {
        if (closed) return reject(new Error('Closed'));

        if (!encoder.write(datagram)) {
          await new Promise(cb => encoder.once('drain', cb));
        }

        if (!(datagram instanceof _nms.NmsDatagram) || datagram.notReply) {
          return resolve();
        }

        waited.push(new WaitedNmsDatagram(datagram, resolve, reject, stopWaiting));
      });
    });
  }

  ping(address) {
    debug(`ping [${address.toString()}] ${this.path}`);
    const now = Date.now();
    return this.sendDatagram((0, _nms.createNmsRead)(address, VERSION_ID)).then(datagram => {
      return Reflect.getOwnMetadata('timeStamp', datagram) - now;
    }).catch(() => {
      // debug(`ping [${address}] failed ${reson}`);
      return -1;
    });
  }

  findByType(type = MINIHOST_TYPE) {
    debug(`findByType ${type} on ${this.path} (${this.description.category})`);
    const sarp = (0, _sarp.createSarp)(_sarp.SarpQueryType.ByType, [0, 0, 0, type >> 8 & 0xFF, type & 0xFF]);
    return this.sendDatagram(sarp);
  }

  async getVersion(address) {
    const nmsRead = (0, _nms.createNmsRead)(address, VERSION_ID);

    try {
      const {
        value,
        status
      } = await this.sendDatagram(nmsRead);

      if (status !== 0) {
        debug('<error>', status);
        return [];
      }

      const version = value & 0xFFFF;
      const type = value >>> 16;
      return [version, type];
    } catch (err) {
      debug('<error>', err.message || err);
      return [];
    }
  }

}

var _default = NibusConnection;
exports.default = _default;