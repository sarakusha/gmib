"use strict";

var _Address = _interopRequireWildcard(require("./Address"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

describe('Address', () => {
  describe('constructor', () => {
    test('should be empty', () => {
      const empty = new _Address.default();
      expect(empty).toHaveProperty('type', _Address.AddressType.empty);
      expect(empty.isEmpty).toBe(true);
      expect(new _Address.default(empty.toString())).toHaveProperty('isEmpty', true);
      expect(new _Address.default([0, 0, 0, 0, 0, 0])).toHaveProperty('isEmpty', true);
    });
    test('should be net', () => {
      const net = expect(new _Address.default('FE.56.34'));
      net.toHaveProperty('type', _Address.AddressType.net);
      net.toHaveProperty('domain', 0xFE);
      net.toHaveProperty('subnet', 0x56);
      net.toHaveProperty('device', 0x34);
    });
    test('should be group', () => {
      const group = expect(new _Address.default('255.128'));
      group.toHaveProperty('domain', 255);
      group.toHaveProperty('group', 128);
      group.toHaveProperty('type', _Address.AddressType.group);
    });
    test('should be string mac', () => {
      const address = new _Address.default('01::FF:23');
      const address2 = new _Address.default('::45:77');
      const empty = new _Address.default('::0');
      expect(address).toHaveProperty('type', _Address.AddressType.mac);
      expect(address.mac && address.mac.equals(Buffer.from([1, 0, 0, 0, 255, 0x23]))).toBe(true);
      expect(address2.mac && address2.mac.equals(Buffer.from([0, 0, 0, 0, 0x45, 0x77]))).toBe(true);
      expect(empty).toHaveProperty('type', _Address.AddressType.empty);
    });
    test('should be array mac', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const mac = new Uint8Array(array);
      const address = new _Address.default(mac);
      expect(address.mac && address.mac.equals(mac)).toBe(true);
      expect(address).toHaveProperty('type', _Address.AddressType.mac);
    });
  });
  describe('comparision', () => {
    const a = new _Address.default('::45:78');
    const b = new _Address.default([0, 0, 0, 0, 0x45, 0x78]);
    const c = new _Address.default();
    const d = new _Address.default('::45:79');
    test('should be equal', () => {
      expect(a.equals(b)).toBe(true);
      expect(a.equals(a)).toBe(true);
      expect(c.equals(_Address.default.empty)).toBe(true);
      expect(a.equals(new _Address.default(a))).toBe(true);
    });
    test('shouldn\'t be equal', () => {
      expect(a.equals(c)).toBe(false);
      expect(a.equals(d)).toBe(false);
    });
  });
  test('toString', () => {
    expect(new _Address.default().toString()).toBe('::0');
    expect(_Address.default.broadcast.toString()).toBe('FF:FF:FF:FF:FF:FF');
    expect(new _Address.default('::12:3f').toString()).toBe('::12:3F');
    expect(new _Address.default([1, 2, 3, 4, 5, 6]).toString()).toBe('01:02:03:04:05:06');
    expect(new _Address.default('ff.0.1').toString()).toBe('255.0.1');
    expect(new _Address.default('12.34').toString()).toBe('12.34');
  });
});