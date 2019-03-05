import _ from 'lodash';
import { AddressParam } from '../Address';
import { NMS_MAX_DATA_LENGTH } from '../nbconst';
import { encodeValue, getNmsType } from './nms';
import NmsDatagram from './NmsDatagram';
import NmsServiceType from './NmsServiceType';
import NmsValueType from './NmsValueType';

export { NmsServiceType };
export { NmsValueType };
export { NmsDatagram };
export { getNmsType };

export function createNmsRead(destination: AddressParam, ...ids: number[]) {
  if (ids.length > 21) {
    throw new Error('To many properties (21)');
  }
  const [id, ...rest] = ids;
  const nms = _.flatten(rest.map(next => [
    NmsServiceType.Read << 3 | next >> 8,
    next & 0xff,
    0,
  ]));
  const datagram = new NmsDatagram({
    destination,
    id,
    isResponsible: true,
    nms: Buffer.from(nms),
    service: NmsServiceType.Read,
  });
  // if (ids.length > 1) {
  //   datagram.data[2] = datagram.data[2] & 0xC0;
  // }
  return datagram;
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
  nms.writeUInt32LE(offset, 0);
  nms.writeUInt8(length, 4);
  return new NmsDatagram({
    destination,
    id,
    nms,
    service: NmsServiceType.UploadSegment,
  });
}

export function createNmsRequestDomainDownload(destination: AddressParam, domain: string) {
  if (domain.length !== 8) {
    throw new Error('domain must be string of 8 characters');
  }
  return new NmsDatagram({
    destination,
    id: 0,
    nms: Buffer.from(domain, 'ascii'),
    service: NmsServiceType.RequestDomainDownload,
  });
}

export function createNmsInitiateDownloadSequence(destination: AddressParam, id: number) {
  return new NmsDatagram({
    destination,
    id,
    service: NmsServiceType.InitiateDownloadSequence,
  });
}

export function createNmsDownloadSegment(
  destination: AddressParam,
  id: number,
  offset: number,
  data: Buffer) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }
  const max = NMS_MAX_DATA_LENGTH - 4;
  if (data.length > max) {
    throw new Error(`Too big data. No more than ${max} bytes at a time`);
  }
  const ofs = Buffer.alloc(4, 0, 'binary');
  ofs.writeUInt32LE(offset, 0);

  return new NmsDatagram({
    destination,
    id,
    nms: Buffer.concat([ofs, data]),
    service: NmsServiceType.DownloadSegment,
  });
}

export function createNmsTerminateDownloadSequence(destination: AddressParam, id: number) {
  return new NmsDatagram({
    destination,
    id,
    service: NmsServiceType.TerminateDownloadSequence,
  });
}

export function createNmsVerifyDomainChecksum(
  destination: AddressParam,
  id: number,
  offset: number,
  size: number,
  crc: number) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }
  if (size < 0 || 0xFFFF < size) {
    throw new Error('Invalid size');
  }
  const nms = Buffer.alloc(10, 0, 'binary');
  nms.writeUInt32LE(offset, 0);
  nms.writeUInt32LE(size, 4);
  nms.writeUInt16LE(crc, 8);
  return new NmsDatagram({
    destination,
    id,
    nms,
    service: NmsServiceType.VerifyDomainChecksum,
  });
}
