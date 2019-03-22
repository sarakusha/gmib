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

const debug = (0, _debug.default)('nibus:decoder'); // const debugSerial = debugFactory('nibus-serial:decoder');

function crcNibus(byteArray) {
  const crc = (0, _crc.crc16ccitt)(Buffer.from(byteArray), 0);
  return crc === 0;
}

class NibusDecoder extends _stream.Transform {
  // private state = States.PREAMBLE_WAITING;
  // private datagram: number[] = [];
  // private expectedLength = 0;
  constructor(options) {
    super({ ...options,
      readableObjectMode: true
    });

    _defineProperty(this, "buf", []);
  } // tslint:disable-next-line


  _transform(chunk, encoding, callback) {
    console.assert(encoding === 'buffer', 'Unexpected encoding'); // console.log('@@@@@@@@', printBuffer(chunk));

    const data = [...this.buf, ...chunk];

    if (data.length > 0) {
      this.buf = this.analyze(data);
    }

    callback();
  } // tslint:disable-next-line


  _flush(callback) {
    this.buf.length = 0; // this.datagram.length = 0;
    // this.expectedLength = 0;
    // this.state = States.PREAMBLE_WAITING;

    callback();
  }

  analyze(data) {
    let start = -1;
    let lastEnd = 0;
    let expectedLength = -1;
    let state = _nbconst.States.PREAMBLE_WAITING;

    const reset = () => {
      console.assert(start !== -1, 'reset outside datagram');
      const ret = start;
      start = expectedLength = -1;
      state = _nbconst.States.PREAMBLE_WAITING;
      return ret;
    };

    for (let i = 0; i < data.length; i += 1) {
      switch (state) {
        case _nbconst.States.PREAMBLE_WAITING:
          if (data[i] === _nbconst.PREAMBLE) {
            state = _nbconst.States.HEADER_READING;
            start = i;
          }

          break;

        case _nbconst.States.HEADER_READING:
          if (i - start === _nbconst.Offsets.LENGTH) {
            const length = data[start + _nbconst.Offsets.LENGTH]; // this.datagram[Offsets.LENGTH];

            if (length - 1 > _nbconst.MAX_DATA_LENGTH) {
              i = reset();
              continue;
            }

            state = _nbconst.States.DATA_READING;
            expectedLength = length + _nbconst.SERVICE_INFO_LENGTH + 2 - 1;
          }

          break;

        case _nbconst.States.DATA_READING:
          if (expectedLength === i - start + 1) {
            state = _nbconst.States.PREAMBLE_WAITING;
            const datagram = data.slice(start, i + 1);

            if (crcNibus(datagram.slice(1))) {
              const frame = Buffer.from(datagram);

              if (start > lastEnd) {
                debug('skipped: ', (0, _helper.printBuffer)(Buffer.from(data.slice(lastEnd, start))));
              }

              if (_nms.NmsDatagram.isNmsFrame(frame)) {
                this.push(new _nms.NmsDatagram(frame));
              } else if (_sarp.SarpDatagram.isSarpFrame(frame)) {
                this.push(new _sarp.SarpDatagram(frame));
              } else {
                this.push(new _NibusDatagram.default(frame));
              }

              start = expectedLength = -1;
              state = _nbconst.States.PREAMBLE_WAITING;
              lastEnd = i + 1;
            } else {
              debug('CRC error');
              i = reset();
              continue;
            }
          }

          break;

        default:
          console.assert(true, 'Unexpected state');
          break;
      }
    } // for


    const skipped = start === -1 ? data.slice(lastEnd) : data.slice(lastEnd, start);
    if (skipped.length) debug('skipped: ', (0, _helper.printBuffer)(Buffer.from(skipped)));
    return start === -1 ? [] : data.slice(start);
  }

}

exports.default = NibusDecoder;