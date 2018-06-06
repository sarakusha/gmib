/* eslint-disable no-bitwise */
import { Offsets } from '../nbconst';
import { getSizeOf, decodeValue, NmsValueType, NmsServiceType } from './index';
import NibusDatagram from '../nibus/datagram';

export default class NmsDatagram extends NibusDatagram {
  constructor(frame) {
    super(frame);
    const { data } = this;
    this.isResponse = !!(data[0] & 4);
    this.service = data[0] >> 3;
    this.id = ((data[0] & 3) << 8) | data[1];
    const nmsLength = data[2] & 0x3F;
    this.nms = data.slice(3, 3 + nmsLength);
  }

  get valueType() {
    const { nms, service } = this;
    switch (service) {
      case NmsServiceType.Read:
        if (nms.length > 2) {
          return this.nms[1];
        }
        break;
      case NmsServiceType.InformationReport:
        return this.nms[0];
      default:
        break;
    }
    return undefined;
  }

  get status() {
    if (this.nms.length === 0) return undefined;
    return this.nms.readInt8(0);
  }

  get value() {
    const { valueType, nms, service } = this;
    const { length } = nms;
    const safeDecode = (index, type = valueType) => (length < index + getSizeOf(type)
      ? undefined
      : decodeValue(type, nms, index));
    switch (service) {
      case NmsServiceType.Read:
        return safeDecode(2);
      case NmsServiceType.InformationReport:
        return safeDecode(1);
      case NmsServiceType.RequestDomainUpload:
        return safeDecode(1, NmsValueType.UInt32);
      case NmsServiceType.UploadSegment:
        return {
          offset: safeDecode(1, NmsValueType.UInt32),
          data: nms.slice(5),
        };
      default:
        return undefined;
    }
  }

  static isNmsFrame(frame) {
    return frame.length > 15 && frame[Offsets.PROTOCOL] === 1 && frame[Offsets.LENGTH] > 3;
  }
}
