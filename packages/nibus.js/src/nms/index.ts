import _ from 'lodash';
import { AddressParam } from '../Address';
import NmsDatagram from './NmsDatagram';
import { encodeValue, getNmsType } from './nms';
import NmsServiceType from './NmsServiceType';
import NmsValueType from './NmsValueType';

export { NmsServiceType };
export { NmsValueType };
export { NmsDatagram };
export { getNmsType };

export function createNmsRead(destination: AddressParam, id: number, ...ids: number[]) {
  if (ids.length > 20) {
    throw new Error('To many properties (21)');
  }
  const nms = _.flatten(ids.map(next => [
    NmsServiceType.Read << 3 | next >> 8,
    next & 0xff,
    0,
  ]));
  return new NmsDatagram({
    destination,
    id,
    isResponsible: true,
    nms: Buffer.from(nms),
    service: NmsServiceType.Read,
  });
}

export function createNmsWrite(
  destination: AddressParam, id: number, type: NmsValueType, value: any, isResponsible = true) {
  const nms = encodeValue(type, value);
  return new NmsDatagram({
    destination,
    id,
    isResponsible,
    nms,
    service: NmsServiceType.Write,
  });
}

export function createNmsInitiateUploadSequence(destination: AddressParam, id: number) {
  return new NmsDatagram({
    destination,
    id,
    service: NmsServiceType.InitiateUploadSequence,
  });
}

export function createNmsRequestDomainUpload(destination: AddressParam, domain: string) {
  if (domain.length !== 8) {
    throw new Error('domain must be string of 8 characters');
  }
  return new NmsDatagram({
    destination,
    id: 0,
    nms: Buffer.from(domain, 'ascii'),
    service: NmsServiceType.RequestDomainUpload,
  });
}

export function createNmsUploadSegment(
  destination: AddressParam, id: number, offset: number, length: number) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }
  if (length < 0 || 255 < length) {
    throw new Error('Invalid length');
  }
  const nms = Buffer.alloc(5);
  nms.writeInt32LE(offset, 0);
  nms.writeUInt8(length, 4);
  return new NmsDatagram({
    destination,
    id,
    nms,
    service: NmsServiceType.UploadSegment,
  });
}
