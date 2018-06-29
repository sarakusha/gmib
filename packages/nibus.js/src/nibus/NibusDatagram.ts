import { crc16ccitt } from 'crc';
import Address, { AddressParam } from '../Address';
import { MAX_DATA_LENGTH, Offsets, PREAMBLE } from '../nbconst';

// import {timeStamp} from '../utils';

export interface INibusCommon {
  destination: AddressParam;
  priority?: number;
  source?: AddressParam;
}

export interface INibusOptions extends INibusCommon {
  protocol: number;
  data: Buffer;
}

// @timeStamp
export default class NibusDatagram implements INibusOptions {
  public static defaultSource: AddressParam = Address.empty;
  public readonly priority: number;
  public readonly protocol: number;
  public readonly destination: Address;
  public readonly source: Address;
  public readonly data: Buffer;

  // @noenum
  public readonly raw: Buffer;

  // @noenum
  // public readonly timeStamp: number;

  constructor(frameOrOptions: Buffer | INibusOptions) {
    if (Buffer.isBuffer(frameOrOptions)) {
      const frame: Buffer = Buffer.from(frameOrOptions);
      console.assert(
        Offsets.DATA < frame.length && frame.length < 256,
        'Invalid datagram',
      );
      this.raw = frame;
    } else {
      const options = {
        priority: 0,
        source: NibusDatagram.defaultSource,
        ...frameOrOptions,
      };
      // console.log('OPTIONS', options, frameOrOptions);
      console.assert(options.data.length <= MAX_DATA_LENGTH);
      const destination = Address.toAddress(options.destination)!;
      const source = Address.toAddress(options.source)!;
      const frame = [
        PREAMBLE,
        ...destination.raw,
        ...source.raw,
        0xC0 | (options.priority & 3) << 4 | (destination.rawType & 3) << 2 | (source.rawType & 3),
        options.data.length + 1,
        options.protocol,
        ...options.data,
      ];
      const crc = crc16ccitt(Buffer.from(frame.slice(1)), 0);
      frame.push(crc >> 8, crc & 255);
      this.raw = Buffer.from(frame);
    }
    const serviceByte = this.raw[Offsets.SERVICE];
    const destAddressType = (serviceByte >> 2) & 3;
    const srcAddressType = serviceByte & 3;

    this.priority = (serviceByte >> 4) & 3;
    this.protocol = this.raw[Offsets.PROTOCOL];
    this.destination = Address.read(destAddressType, this.raw, Offsets.DESTINATION);
    this.source = Address.read(srcAddressType, this.raw, Offsets.SOURCE);
    // Реальная длина данных на 1 меньше чем указано в LENGTH!
    this.data = this.raw.slice(Offsets.DATA, (Offsets.DATA + this.raw[Offsets.LENGTH]) - 1);
    Reflect.defineMetadata('timeStamp', Date.now(), this);
    process.nextTick(() => Object.freeze(this));
  }
}
