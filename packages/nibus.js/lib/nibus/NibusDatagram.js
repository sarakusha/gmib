"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Protocol = void 0;

require("reflect-metadata");

var _crc = require("crc");

var _lodash = _interopRequireDefault(require("lodash"));

var _Address = _interopRequireDefault(require("../Address"));

var _nbconst = require("../nbconst");

var _helper = require("./helper");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

let Protocol;
exports.Protocol = Protocol;

(function (Protocol) {
  Protocol[Protocol["NMS"] = 1] = "NMS";
  Protocol[Protocol["SARP"] = 2] = "SARP";
})(Protocol || (exports.Protocol = Protocol = {}));

const leadZero = value => `0${value}`.slice(-2);

// @timeStamp
class NibusDatagram {
  // @noenum
  // @noenum
  // public readonly timeStamp: number;
  constructor(frameOrOptions) {
    _defineProperty(this, "priority", void 0);

    _defineProperty(this, "protocol", void 0);

    _defineProperty(this, "destination", void 0);

    _defineProperty(this, "source", void 0);

    _defineProperty(this, "data", void 0);

    _defineProperty(this, "raw", void 0);

    if (Buffer.isBuffer(frameOrOptions)) {
      const frame = Buffer.from(frameOrOptions);
      console.assert(_nbconst.Offsets.DATA < frame.length && frame.length < 256, 'Invalid datagram');
      this.raw = frame;
    } else {
      const options = {
        priority: 0,
        source: NibusDatagram.defaultSource,
        ...frameOrOptions
      }; // console.log('OPTIONS', options, frameOrOptions);

      console.assert(options.data.length <= _nbconst.MAX_DATA_LENGTH);

      const destination = _Address.default.toAddress(options.destination);

      const source = _Address.default.toAddress(options.source);

      const frame = [_nbconst.PREAMBLE, ...destination.raw, ...source.raw, 0xC0 | (options.priority & 3) << 4 | (destination.rawType & 3) << 2 | source.rawType & 3, options.data.length + 1, options.protocol, ...options.data];
      const crc = (0, _crc.crc16ccitt)(Buffer.from(frame.slice(1)), 0);
      frame.push(crc >> 8, crc & 255);
      this.raw = Buffer.from(frame);
    }

    const serviceByte = this.raw[_nbconst.Offsets.SERVICE];
    const destAddressType = serviceByte >> 2 & 3;
    const srcAddressType = serviceByte & 3;
    this.priority = serviceByte >> 4 & 3;
    this.protocol = this.raw[_nbconst.Offsets.PROTOCOL];
    this.destination = _Address.default.read(destAddressType, this.raw, _nbconst.Offsets.DESTINATION);
    this.source = _Address.default.read(srcAddressType, this.raw, _nbconst.Offsets.SOURCE); // Реальная длина данных на 1 меньше чем указано в LENGTH!

    this.data = this.raw.slice(_nbconst.Offsets.DATA, _nbconst.Offsets.DATA + this.raw[_nbconst.Offsets.LENGTH] - 1);
    Reflect.defineMetadata('timeStamp', Date.now(), this);
    process.nextTick(() => Object.freeze(this));
  }

  toJSON() {
    const ts = new Date(Reflect.getMetadata('timeStamp', this));
    return {
      priority: this.priority,
      protocol: Protocol[this.protocol],
      source: this.source.toString(),
      destination: this.destination.toString(),
      timeStamp: `${leadZero(ts.getHours())}:${leadZero(ts.getMinutes())}:\
${leadZero(ts.getSeconds())}.${ts.getMilliseconds()}`,
      data: Buffer.from(this.data)
    };
  }

  toString(opts) {
    let self = replaceBuffers(this.toJSON());

    if (opts) {
      if (opts.pick) {
        self = _lodash.default.pick(self, opts.pick);
      }

      if (opts.omit) {
        self = _lodash.default.omit(self, opts.omit);
      }
    }

    return JSON.stringify(self);
  }

}

exports.default = NibusDatagram;

_defineProperty(NibusDatagram, "defaultSource", _Address.default.empty);

const replaceBuffers = obj => {
  Object.entries(obj).forEach(([name, value]) => {
    if (Buffer.isBuffer(value)) {
      obj[name] = (0, _helper.printBuffer)(value);
    } else if (_lodash.default.isPlainObject(value)) {
      obj[name] = replaceBuffers(value);
    }
  });
  return obj;
};