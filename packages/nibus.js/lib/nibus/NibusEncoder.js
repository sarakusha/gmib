"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _stream = require("stream");

var _debug = _interopRequireDefault(require("debug"));

var _helper = require("./helper");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debugSerial = (0, _debug.default)('nibus-serial:encoder');

class NibusEncoder extends _stream.Transform {
  constructor(options) {
    super({ ...options,
      writableObjectMode: true
    });
  } // tslint:disable-next-line


  _transform(chunk, encoding, callback) {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    chunks.forEach(datagram => {
      debugSerial((0, _helper.printBuffer)(datagram.raw));
      this.push(datagram.raw);
    });
    callback();
  }

}

exports.default = NibusEncoder;