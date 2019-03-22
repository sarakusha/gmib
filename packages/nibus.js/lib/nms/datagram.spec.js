"use strict";

var _crc = require("crc");

var _Address = _interopRequireDefault(require("../Address"));

var _nbconst = require("../nbconst");

var _NmsDatagram = _interopRequireDefault(require("./NmsDatagram"));

var _index = require("./index");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('NmsDatagram tests', () => {
  const options = {
    destination: new _Address.default('::12:34'),
    id: 123,
    isResponse: true,
    notReply: false,
    nms: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    priority: 3,
    service: _index.NmsServiceType.Read,
    source: new _Address.default('FF::67')
  };
  test('options test', () => {
    const nms = new _NmsDatagram.default(options);
    expect(nms).toHaveProperty('destination', options.destination);
    expect(nms).toHaveProperty('id', options.id);
    expect(nms).toHaveProperty('isResponse', options.isResponse);
    expect(nms).toHaveProperty('notReply', options.notReply);
    expect(nms).toHaveProperty('nms', options.nms);
    expect(nms).toHaveProperty('priority', options.priority);
    expect(nms).toHaveProperty('service', options.service);
    expect(nms).toHaveProperty('source', options.source);
    expect(nms).toHaveProperty('protocol', 1);
  });
  test('to raw test', () => {
    const nms = new _NmsDatagram.default(options);
    expect(nms.raw.readInt8(0)).toBe(_nbconst.PREAMBLE);
    expect(nms.raw.length).toBe(_nbconst.Offsets.DATA + (3 + options.nms.length) + 2);
  });
  test('from raw test', () => {
    const hexFrame = '7e000000006efa000000000000c004010802008d0d';
    const frame = Buffer.from(hexFrame, 'hex');
    const nms = new _NmsDatagram.default(frame);
    expect(nms.destination.equals('::6e:fa')).toBe(true);
    expect(nms.source.equals(_Address.default.empty)).toBe(true);
    expect(nms.service).toBe(_index.NmsServiceType.Read);
    expect(nms.id).toBe(2);
    expect((0, _crc.crc16ccitt)(frame.slice(1, -2), 0)).toBe(frame.readUInt16BE(frame.length - 2));
  });
  test('circular test', () => {
    const nms = new _NmsDatagram.default(options); // console.log(nms);

    const copy = new _NmsDatagram.default(nms.raw); // console.log(copy);

    expect(nms).toEqual(copy);
    expect(nms.raw.equals(copy.raw)).toBe(true);
  });
  test('NmsRead', () => {
    const read = (0, _index.createNmsRead)(_Address.default.empty, 2);
    expect(read).toHaveProperty('id', 2);
  });
});