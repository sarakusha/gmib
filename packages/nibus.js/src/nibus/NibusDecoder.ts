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
  private state = States.PREAMBLE_WAITING;
  private datagram: number[] = [];
  private expectedLength = 0;

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
    let data = [...chunk];
    while (data.length > 0) {
      data = this.analyze(data);
    }
    callback();
  }

  // tslint:disable-next-line
  public _flush(callback: TransformCallback) {
    this.datagram.length = 0;
    this.expectedLength = 0;
    this.state = States.PREAMBLE_WAITING;
    callback();
  }

  private analyze(data: number[]) {
    const skipped: number[] = [];
    const reset = (index: number) => {
      skipped.push(this.datagram[0]);
      debugSerial('dropped: ', printBuffer(Buffer.from(skipped)));
      const retry = [...this.datagram, ...data.slice(index + 1)].slice(1);
      this.datagram.length = 0;
      this.state = States.PREAMBLE_WAITING;
      return retry;
    };
    for (let i = 0; i < data.length; i += 1) {
      const b = data[i];
      switch (this.state) {
        case States.PREAMBLE_WAITING:
          if (b === PREAMBLE) {
            this.state = States.HEADER_READING;
            this.datagram = [b];
          } else {
            skipped.push(b);
          }
          break;
        case States.HEADER_READING:
          this.datagram.push(b);
          if (this.datagram.length > Offsets.LENGTH) {
            const length = this.datagram[Offsets.LENGTH];
            if (length - 1 > MAX_DATA_LENGTH) {
              return reset(i);
            }
            this.state = States.DATA_READING;
            this.expectedLength = (length + SERVICE_INFO_LENGTH + 2) - 1;
          }
          break;
        case States.DATA_READING:
          this.datagram.push(b);
          if (this.expectedLength === this.datagram.length) {
            this.state = States.PREAMBLE_WAITING;
            if (crcNibus(this.datagram.slice(1))) {
              const frame = Buffer.from(this.datagram);
              skipped.length > 0 && debugSerial('skipped: ', printBuffer(Buffer.from(skipped)));
              this.datagram.length = 0;
              skipped.length = 0;
              if (NmsDatagram.isNmsFrame(frame)) {
                this.push(new NmsDatagram(frame));
              } else if (SarpDatagram.isSarpFrame(frame)) {
                this.push(new SarpDatagram(frame));
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
}
