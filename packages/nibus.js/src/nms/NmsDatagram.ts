import Address from '../Address';
import { NMS_MAX_DATA_LENGTH, Offsets, PREAMBLE } from '../nbconst';
import { INibusCommon, INibusDatagramJSON, INibusOptions, NibusDatagram, Protocol } from '../nibus';
import { decodeValue, getSizeOf } from './nms';
import NmsServiceType from './NmsServiceType';
import NmsValueType from './NmsValueType';

export interface INmsOptions extends INibusCommon {
  id: number;
  service: NmsServiceType;
  nms?: Buffer;
  isResponse?: boolean;
  isResponsible?: boolean;
  status?: number;
}

const emptyBuffer = Buffer.alloc(0);

export interface INmsDatagramJSON extends INibusDatagramJSON {
  protocol: Protocol.NMS;
  data?: never;
  id: number;
  service: NmsServiceType;
  nms?: Buffer;
  isResponse?: boolean;
  isResponsible?: boolean;
  value?: string;
  valueType?: string;
  status?: number;
}

export default class NmsDatagram extends NibusDatagram implements INmsOptions {
  public static isNmsFrame(frame: Buffer) {
    return frame[0] === PREAMBLE && frame.length > 15 && frame[Offsets.PROTOCOL] === 1
      && frame[Offsets.LENGTH] > 3;
  }

  public readonly isResponse: boolean;
  public readonly isResponsible: boolean;
  public readonly service: number;
  public readonly id: number;
  public readonly nms: Buffer;

  constructor(frameOrOptions: Buffer | INmsOptions) {
    if (Buffer.isBuffer(frameOrOptions)) {
      super(frameOrOptions);
    } else {
      const options = {
        source: new Address('auto'),
        isResponse: false,
        isResponsible: true,
        nms: emptyBuffer,
        ...frameOrOptions,
      };
      console.assert(options.nms.length <= NMS_MAX_DATA_LENGTH);
      // fix: NMS batch read
      const nmsLength = options.service !== NmsServiceType.Read
        ? (options.nms.length & 0x3f)
        : 0;
      const nibusData = [
        ((options.service & 0x1f) << 3) | (options.isResponse ? 4 : 0) | ((options.id >> 8) & 3),
        options.id & 0xff,
        (options.isResponsible ? 0 : 0x80) | nmsLength,
        ...options.nms,
      ];
      const nibusOptions: INibusOptions = Object.assign({
        data: Buffer.from(nibusData),
        protocol: 1,
      }, options);
      super(nibusOptions);
    }
    const { data } = this;
    this.id = ((data[0] & 3) << 8) | data[1];
    this.service = data[0] >> 3;
    this.isResponse = !!(data[0] & 4);
    this.isResponsible = (data[2] & 0x80) === 0;
    // fix: NMS batch read
    const nmsLength = this.service !== NmsServiceType.Read
      ? data[2] & 0x3F
      : data.length - 3;
    this.nms = this.data.slice(3, 3 + nmsLength);
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
    if (this.nms.length === 0) {
      return undefined;
    }
    return this.nms.readInt8(0);
  }

  get value() {
    const { valueType, nms, service } = this;
    if (valueType === undefined) {
      return undefined;
    }
    const { length } = nms;
    const safeDecode = (index: number, type = valueType) => (length < index + getSizeOf(type)
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
          data: nms.slice(5),
          offset: safeDecode(1, NmsValueType.UInt32),
        };
      default:
        return undefined;
    }
  }

  public isResponseFor(req: NmsDatagram) {
    const { isResponse, service, source, id } = this;
    return isResponse && service === req.service
      && (source.equals(req.destination) || (id === req.id && req.destination.isEmpty));
  }

  public toJSON(): INmsDatagramJSON {
    const { data, protocol, ...props } = super.toJSON();
    const result: INmsDatagramJSON = {
      ...props,
      protocol: Protocol.NMS,
      id: this.id,
      service: this.service,
      data: undefined,
    };
    if (this.isResponse) {
      if (this.valueType !== undefined) {
        result.value = this.value.toString();
        result.valueType = NmsValueType[this.valueType];
      }
      result.status = this.status;
    } else {
      result.isResponsible = this.isResponsible;
      result.nms = Buffer.from(this.nms);
    }
    return result;
  }
}
