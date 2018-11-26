"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.MINIHOST_TYPE = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _serialport = _interopRequireDefault(require("serialport"));

var _events = require("events");

var _debug = _interopRequireDefault(require("debug"));

var _errors = require("../errors");

var _nms = require("../nms");

var _NmsServiceType = _interopRequireDefault(require("../nms/NmsServiceType"));

var _sarp = require("../sarp");

var _NibusEncoder = _interopRequireDefault(require("./NibusEncoder"));

var _NibusDecoder = _interopRequireDefault(require("./NibusDecoder"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const MINIHOST_TYPE = 0xabc6;
exports.MINIHOST_TYPE = MINIHOST_TYPE;
const debug = (0, _debug.default)('nibus:connection');
const portOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
};
const NIBUS_TIMEOUT = 1000;

class WaitedNmsDatagram {
  constructor(req, resolve, reject, callback) {
    this.req = req;

    _defineProperty(this, "resolve", void 0);

    let timer;
    let counter = req.service !== _NmsServiceType.default.Read ? 1 : Math.floor(req.nms.length / 3) + 1;
    const datagrams = [];

    const timeout = () => {
      callback(this);
      datagrams.length === 0 ? reject(new _errors.TimeoutError()) : resolve(datagrams);
    };

    const restart = (step = 1) => {
      counter -= step;
      clearTimeout(timer);

      if (counter > 0) {
        timer = setTimeout(timeout, NIBUS_TIMEOUT);
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
/**
 * @fires sarp
 * @fires data
 */


class NibusConnection extends _events.EventEmitter {
  onDatagram(datagram) {
    let showLog = true;

    if (datagram instanceof _nms.NmsDatagram) {
      if (datagram.isResponse) {
        const waited = this.waited.find(waited => datagram.isResponseFor(waited.req));

        if (waited) {
          waited.resolve(datagram);
          showLog = false;
        }
      }
      /**
       * @event NibusConnection#data
       * @param {NibusDatagram} datagram
       */


      this.emit('data', datagram);
    } else if (datagram instanceof _sarp.SarpDatagram) {
      showLog = false;
      /**
       * @event NibusConnection#sarp
       * @param {SarpDatagram} datagram
       */

      this.emit('sarp', datagram);
    }

    showLog && debug(`datagram received`, JSON.stringify(datagram.toJSON()));
  }

  constructor(port, description) {
    super();
    this.port = port;
    this.description = description;

    _defineProperty(this, "serial", void 0);

    _defineProperty(this, "encoder", new _NibusEncoder.default());

    _defineProperty(this, "decoder", new _NibusDecoder.default());

    _defineProperty(this, "ready", Promise.resolve());

    _defineProperty(this, "closed", false);

    _defineProperty(this, "waited", []);

    _defineProperty(this, "stopWaiting", waited => _lodash.default.remove(this.waited, waited));

    this.serial = new _serialport.default(port, { ...portOptions,
      baudRate: description.baudRate || 115200
    });
    this.serial.pipe(this.decoder);
    this.encoder.pipe(this.serial);
    this.decoder.on('data', this.onDatagram.bind(this));
    debug(`new connection on ${port} (${description.category})`);
  }

  sendDatagram(datagram) {
    // debug('write datagram', JSON.stringify(datagram.toJSON()));
    const {
      encoder,
      stopWaiting,
      waited,
      closed
    } = this;
    return new Promise((resolve, reject) => {
      this.ready = this.ready.finally(async () => {
        if (closed) return reject(new Error('Closed'));

        if (!this.serial.isOpen) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(reject, 2000);
            this.serial.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }

        if (!encoder.write(datagram)) {
          await new Promise(cb => encoder.once('drain', cb));
        }

        if (!(datagram instanceof _nms.NmsDatagram) || !datagram.isResponsible) {
          return resolve();
        }

        waited.push(new WaitedNmsDatagram(datagram, resolve, reject, stopWaiting));
      });
    });
  }

  findByType(type = MINIHOST_TYPE) {
    const sarp = (0, _sarp.createSarp)(_sarp.SarpQueryType.ByType, [0, 0, 0, type >> 8 & 0xFF, type & 0xFF]);
    return this.sendDatagram(sarp);
  }

  close(callback) {
    const {
      port,
      description
    } = this;
    debug(`close connection on ${port} (${description.category})`);
    this.closed = true;
    this.encoder.end();
    this.decoder.removeAllListeners('data');

    if (this.serial.isOpen) {
      this.serial.close(callback);
    } else {
      callback && callback();
    }
  }

}

exports.default = NibusConnection;