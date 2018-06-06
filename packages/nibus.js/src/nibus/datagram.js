/* eslint-disable no-bitwise */
import { Offsets } from '../nbconst';
import Address from '../address';

export default class NibusDatagram {
  constructor(frame) {
    console.assert(
      Buffer.isBuffer(frame) && frame.length > Offsets.DATA,
      'Invalid datagram',
    );
    const serviceByte = frame[Offsets.SERVICE];
    const destAddressType = (serviceByte >> 2) & 3;
    const srcAddressType = serviceByte & 3;

    this.timeStamp = Date.now();
    this.priority = (serviceByte >> 4) & 3;
    this.protocol = frame[Offsets.PROTOCOL];
    this.destination = Address.read(destAddressType, frame, Offsets.DESTINATION);
    this.source = Address.read(srcAddressType, frame, Offsets.SOURCE);
    this.data = frame.slice(Offsets.DATA, (Offsets.DATA + frame[Offsets.LENGTH]) - 1);
    process.nextTick(() => Object.freeze(this));
  }
}
