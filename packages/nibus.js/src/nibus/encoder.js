/* eslint-disable no-bitwise */
import { Transform } from 'stream';
import { crc16ccitt } from 'crc';
import { PREAMBLE } from '../nbconst';

const getServiceByte = ({ priority, source, destination }) =>
  0xC0 | ((priority & 3) << 4) | ((destination.type & 3) << 2) | (source.type & 3);

export default class NibusEncoder extends Transform {
  constructor(options) {
    super({
      ...options,
      writableObjectMode: true,
    });
  }

  _transform(chunk, encoding, callback) {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    chunks.forEach((datagram) => {
      const frame = [
        PREAMBLE,
        ...datagram.destination.raw,
        ...datagram.source.raw,
        getServiceByte(datagram),
        datagram.data.length + 1,
        datagram.protocol,
        ...datagram.data,
      ];
      const crc = crc16ccitt(frame.slice(1), 0);
      frame.push(crc >> 8, crc & 255);
      this.push(Buffer.from(frame));
    });
    callback();
  }
}
