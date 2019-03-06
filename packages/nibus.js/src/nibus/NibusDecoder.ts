import { crc16ccitt } from 'crc';
import debugFactory from 'debug';
import { Transform, TransformCallback, TransformOptions } from 'stream';
import { MAX_DATA_LENGTH, Offsets, PREAMBLE, SERVICE_INFO_LENGTH, States } from '../nbconst';
import { NmsDatagram } from '../nms';
import { SarpDatagram } from '../sarp';
import { printBuffer } from './helper';
import NibusDatagram from './NibusDatagram';

const debug = debugFactory('nibus:decoder');
const debugSerial = debugFactory('nibus-serial:decoder');

function crcNibus(byteArray: number[]) {
  const crc = crc16ccitt(Buffer.from(byteArray), 0);
  return crc === 0;
}

export default class NibusDecoder extends Transform {
  // private state = States.PREAMBLE_WAITING;
  // private datagram: number[] = [];
  // private expectedLength = 0;
  private buf: number[] = [];

  constructor(options?: TransformOptions) {
    super({
      ...options,
      readableObjectMode: true,
    });
  }

  // tslint:disable-next-line
  public _transform(chunk: any, encoding: string, callback: TransformCallback) {
    console.assert(encoding === 'buffer', 'Unexpected encoding');
    debugSerial(printBuffer(chunk));
    const data = [...this.buf, ...chunk];
    if (data.length > 0) {
      this.buf = this.analyze(data);
    }
    callback();
  }

  // tslint:disable-next-line
  public _flush(callback: TransformCallback) {
    this.buf.length = 0;
    // this.datagram.length = 0;
    // this.expectedLength = 0;
    // this.state = States.PREAMBLE_WAITING;
    callback();
  }

  private analyze(data: number[]) {
    let start = -1;
    let expectedLength = -1;
    let state: States = States.PREAMBLE_WAITING;
    const reset = () => {
      console.assert(start !== -1, 'reset outside datagram');
      const ret = start;
      start = expectedLength = -1;
      state = States.PREAMBLE_WAITING;
      return ret;
    };
    for (let i = 0; i < data.length; i += 1) {
      switch (state) {
        case States.PREAMBLE_WAITING:
          if (data[i] === PREAMBLE) {
            state = States.HEADER_READING;
            start = i;
          }
          break;
        case States.HEADER_READING:
          if (i - start === Offsets.LENGTH) {
            const length = data[start + Offsets.LENGTH]; // this.datagram[Offsets.LENGTH];
            if (length - 1 > MAX_DATA_LENGTH) {
              i = reset();
              continue;
            }
            state = States.DATA_READING;
            expectedLength = (length + SERVICE_INFO_LENGTH + 2) - 1;
          }
          break;
        case States.DATA_READING:
          if (expectedLength === i - start + 1) {
            state = States.PREAMBLE_WAITING;
            const datagram = data.slice(start, i + 1);
            if (crcNibus(datagram.slice(1))) {
              const frame = Buffer.from(datagram);
              start > 0 && debugSerial('skipped: ', printBuffer(Buffer.from(data.slice(0, start))));
              if (NmsDatagram.isNmsFrame(frame)) {
                this.push(new NmsDatagram(frame));
              } else if (SarpDatagram.isSarpFrame(frame)) {
                this.push(new SarpDatagram(frame));
              } else {
                this.push(new NibusDatagram(frame));
              }
              start = expectedLength = -1;
              state = States.PREAMBLE_WAITING;
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
    return start === -1 ? [] : data.slice(start);
  }
}
