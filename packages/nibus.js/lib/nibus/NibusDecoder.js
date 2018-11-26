"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _crc = require("crc");

var _debug = _interopRequireDefault(require("debug"));

var _stream = require("stream");

var _nbconst = require("../nbconst");

var _nms = require("../nms");

var _sarp = require("../sarp");

var _helper = require("./helper");

var _NibusDatagram = _interopRequireDefault(require("./NibusDatagram"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:decoder');
const debugSerial = (0, _debug.default)('nibus-serial:decoder');

function crcNibus(byteArray) {
  const crc = (0, _crc.crc16ccitt)(Buffer.from(byteArray), 0);
  return crc === 0;
}

class NibusDecoder extends _stream.Transform {
  constructor(options) {
    super({ ...options,
      readableObjectMode: true
    });

    _defineProperty(this, "state", _nbconst.States.PREAMBLE_WAITING);

    _defineProperty(this, "datagram", []);

    _defineProperty(this, "expectedLength", 0);
  } // tslint:disable-next-line


  _transform(chunk, encoding, callback) {
    console.assert(encoding === 'buffer', 'Unexpected encoding');
    debugSerial((0, _helper.printBuffer)(chunk));
    let data = [...chunk];

    while (data.length > 0) {
      data = this.analyze(data);
    }

    callback();
  } // tslint:disable-next-line


  _flush(callback) {
    this.datagram.length = 0;
    this.expectedLength = 0;
    this.state = _nbconst.States.PREAMBLE_WAITING;
    callback();
  }

  analyze(data) {
    const skipped = [];

    const reset = index => {
      skipped.push(this.datagram[0]);
      debug('dropped: ', Buffer.from(skipped));
      const retry = [...this.datagram, ...data.slice(index + 1)].slice(1);
      this.datagram.length = 0;
      this.state = _nbconst.States.PREAMBLE_WAITING;
      return retry;
    };

    for (let i = 0; i < data.length; i += 1) {
      const b = data[i];

      switch (this.state) {
        case _nbconst.States.PREAMBLE_WAITING:
          if (b === _nbconst.PREAMBLE) {
            this.state = _nbconst.States.HEADER_READING;
            this.datagram = [b];
          } else {
            skipped.push(b);
          }

          break;

        case _nbconst.States.HEADER_READING:
          this.datagram.push(b);

          if (this.datagram.length > _nbconst.Offsets.LENGTH) {
            const length = this.datagram[_nbconst.Offsets.LENGTH];

            if (length - 1 > _nbconst.MAX_DATA_LENGTH) {
              return reset(i);
            }

            this.state = _nbconst.States.DATA_READING;
            this.expectedLength = length + _nbconst.SERVICE_INFO_LENGTH + 2 - 1;
          }

          break;

        case _nbconst.States.DATA_READING:
          this.datagram.push(b);

          if (this.expectedLength === this.datagram.length) {
            this.state = _nbconst.States.PREAMBLE_WAITING;

            if (crcNibus(this.datagram.slice(1))) {
              const frame = Buffer.from(this.datagram);
              this.datagram.length = 0;

              if (_nms.NmsDatagram.isNmsFrame(frame)) {
                this.push(new _nms.NmsDatagram(frame));
              } else if (_sarp.SarpDatagram.isSarpFrame(frame)) {
                this.push(new _sarp.SarpDatagram(frame));
              } else {
                this.push(new _NibusDatagram.default(frame));
              }
            } else {
              debug('CRC error');
              return reset(i);
            }
          }

          break;

        default:
          console.assert(true, 'Unexpected state');
          break;
      }
    } // for


    return [];
  }

}

exports.default = NibusDecoder;