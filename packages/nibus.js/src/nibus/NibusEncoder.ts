import { Transform, TransformCallback, TransformOptions } from 'stream';
// import debugFactory from 'debug';
// import { printBuffer } from './helper';
import NibusDatagram from './NibusDatagram';

// const debugSerial = debugFactory('nibus-serial:encoder');

export default class NibusEncoder extends Transform {
  constructor(options?: TransformOptions) {
    super({
      ...options,
      writableObjectMode: true,
    });
  }

  // tslint:disable-next-line
  public _transform(chunk: any, encoding: string, callback: TransformCallback) {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    chunks.forEach((datagram: NibusDatagram) => {
      // debugSerial(printBuffer(datagram.raw));
      this.push(datagram.raw);
    });
    callback();
  }
}
