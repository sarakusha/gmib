import { crc16ccitt } from 'crc';
import Address from '../Address';
import { Offsets, PREAMBLE } from '../nbconst';
import NmsDatagram, { INmsOptions } from './NmsDatagram';
import { createNmsRead, NmsServiceType } from './index';

describe('NmsDatagram tests', () => {
  const options: INmsOptions = {
    destination: new Address('::12:34'),
    id: 123,
    isResponse: true,
    isResponsible: true,
    nms: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    priority: 3,
    service: NmsServiceType.Read,
    source: new Address('FF::67'),
  };
  test('options test', () => {
    const nms = new NmsDatagram(options);
    expect(nms).toHaveProperty('destination', options.destination);
    expect(nms).toHaveProperty('id', options.id);
    expect(nms).toHaveProperty('isResponse', options.isResponse);
    expect(nms).toHaveProperty('isResponsible', options.isResponsible);
    expect(nms).toHaveProperty('nms', options.nms);
    expect(nms).toHaveProperty('priority', options.priority);
    expect(nms).toHaveProperty('service', options.service);
    expect(nms).toHaveProperty('source', options.source);
    expect(nms).toHaveProperty('protocol', 1);
  });
  test('to raw test', () => {
    const nms = new NmsDatagram(options);
    expect(nms.raw.readInt8(0)).toBe(PREAMBLE);
    expect(nms.raw.length).toBe(Offsets.DATA + (3 + options.nms!.length) + 2);
  });
  test('from raw test', () => {
    const hexFrame = '7e000000006efa000000000000c004010802008d0d';
    const frame = Buffer.from(hexFrame, 'hex');
    const nms = new NmsDatagram(frame);
    expect(nms.destination.equals('::6e:fa')).toBe(true);
    expect(nms.source.equals(Address.empty)).toBe(true);
    expect(nms.service).toBe(NmsServiceType.Read);
    expect(nms.id).toBe(2);
    expect(crc16ccitt(frame.slice(1, -2), 0)).toBe(frame.readUInt16BE(frame.length - 2));
  });
  test('circular test', () => {
    const nms = new NmsDatagram(options);
    // console.log(nms);
    const copy = new NmsDatagram(nms.raw);
    // console.log(copy);
    expect(nms).toEqual(copy);
    expect(nms.raw.equals(copy.raw)).toBe(true);
  });
  test('NmsRead', () => {
    const read = createNmsRead(Address.empty, 2);
    expect(read).toHaveProperty('id', 2);
  });
});
