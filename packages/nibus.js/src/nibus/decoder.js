import { Transform } from 'stream';
import { crc16ccitt } from 'crc';
import { States, Offsets, PREAMBLE, MAX_DATA_LENGTH, SERVICE_INFO_LENGTH } from '../nbconst';
import NmsDatagram from '../nms/datagram';
import NibusDatagram from './datagram';

const debug = require('debug')('nibus.js');

function crcNibus(byteArray) {
  const crc = crc16ccitt(byteArray, 0);
  return crc === 0;
}

export default class NibusDecoder extends Transform {
  state = States.PREAMBLE_WAITING;
  datagram = [];

  constructor(options) {
    super({
      ...options,
      readableObjectMode: true,
    });
  }

  analyze(data) {
    const reset = (index) => {
      debug('dropped: ', Buffer.from(data, 0, index + 1));
      const retry = [...this.datagram, ...data.slice(index + 1)];
      this.datagram.length = 0;
      this.state = States.PREAMBLE_WAITING;
      return retry;
    };
    for (let i = 0; i < data.length; i += 1) {
      const b = data[i];
      switch (this.receiveState) {
        case States.PREAMBLE_WAITING:
          if (b === PREAMBLE) {
            this.receiveState = States.HEADER_READING;
          }
          break;
        case States.HEADER_READING:
          this.datagram.push(b);
          if (this.datagram.length > Offsets.LENGTH) {
            const length = this.datagram[Offsets.LENGTH];
            if (length - 1 > MAX_DATA_LENGTH) {
              return reset(i);
            }
            this.receiveState = States.DATA_READING;
            this.expectedLength = (length + SERVICE_INFO_LENGTH + 2) - 1;
          }
          break;
        case States.DATA_READING:
          this.datagram.push(b);
          if (this.expectedLength === this.datagram.length) {
            this.receiveState = States.PREAMBLE_WAITING;
            if (crcNibus(this.datagram)) {
              const frame = Buffer.from(this.datagram.slice(0, -2));
              this.datagram.length = 0;
              if (NmsDatagram.isNmsFrame(frame)) {
                this.push(new NmsDatagram(frame));
              } else {
                this.push(new NibusDatagram(frame));
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

  _transform(chunk, encoding, callback) {
    console.assert(encoding === 'buffer');
    let data = [...chunk];
    while (data.length > 0) {
      data = this.analyze(data);
    }
    callback();
  }

  _flush(callback) {
    this.datagram.length = 0;
    callback();
  }
}
