import { Transform, TransformCallback, TransformOptions } from 'stream';
import NibusDatagram from './NibusDatagram';

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
      this.push(datagram.raw);
    });
    callback();
  }
}
