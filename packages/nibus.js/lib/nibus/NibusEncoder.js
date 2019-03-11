"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _stream = require("stream");

// const debugSerial = debugFactory('nibus-serial:encoder');
class NibusEncoder extends _stream.Transform {
  constructor(options) {
    super({ ...options,
      writableObjectMode: true
    });
  } // tslint:disable-next-line


  _transform(chunk, encoding, callback) {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    chunks.forEach(datagram => {
      // debugSerial(printBuffer(datagram.raw));
      this.push(datagram.raw);
    });
    callback();
  }

}

exports.default = NibusEncoder;