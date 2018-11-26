"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Address = _interopRequireDefault(require("../Address"));

var _nbconst = require("../nbconst");

var _nibus = require("../nibus");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class SarpDatagram extends _nibus.NibusDatagram {
  static isSarpFrame(frame) {
    return Buffer.isBuffer(frame) && frame.length === _nbconst.Offsets.DATA + 12 + 2 && frame[_nbconst.Offsets.PROTOCOL] === 2 && frame[_nbconst.Offsets.LENGTH] === 13;
  }

  constructor(frameOrOptions) {
    if (Buffer.isBuffer(frameOrOptions)) {
      super(frameOrOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "queryType", void 0);

      _defineProperty(this, "queryParam", void 0);

      _defineProperty(this, "mac", void 0);
    } else {
      const options = {
        isResponse: false,
        mac: _Address.default.empty.raw,
        ...frameOrOptions
      };

      if (options.queryParam.length !== 5) {
        throw new Error('Invalid query param');
      }

      if (options.mac.length !== 6) {
        throw new Error('Invalid mac param');
      }

      const nibusData = [(options.isResponse ? 0x80 : 0) | options.queryType, ...options.queryParam, ...options.mac];
      const nibusOptions = Object.assign({
        data: Buffer.from(nibusData),
        protocol: 2
      }, options);
      super(nibusOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "queryType", void 0);

      _defineProperty(this, "queryParam", void 0);

      _defineProperty(this, "mac", void 0);
    }

    const {
      data
    } = this;
    console.assert(data.length === 12, 'Unexpected sarp length');
    this.isResponse = (data[0] & 0x80) !== 0;
    this.queryType = data[0] & 0x0f;
    this.queryParam = data.slice(1, 6);
    this.mac = data.slice(6);
  }

}

exports.default = SarpDatagram;