import Address, { AddressType } from './Address';

describe('Address', () => {
  describe('constructor', () => {
    test('should be empty', () => {
      const empty = new Address();
      expect(empty).toHaveProperty('type', AddressType.empty);
      expect(empty.isEmpty).toBe(true);
      expect(new Address(empty.toString())).toHaveProperty('isEmpty', true);
      expect(new Address([0, 0, 0, 0, 0, 0])).toHaveProperty('isEmpty', true);
    });

    test('should be net', () => {
      const net = expect(new Address('FE.56.34'));
      net.toHaveProperty('type', AddressType.net);
      net.toHaveProperty('domain', 0xFE);
      net.toHaveProperty('subnet', 0x56);
      net.toHaveProperty('device', 0x34);
    });

    test('should be group', () => {
      const group = expect(new Address('255.128'));
      group.toHaveProperty('domain', 255);
      group.toHaveProperty('group', 128);
      group.toHaveProperty('type', AddressType.group);
    });

    test('should be string mac', () => {
      const address = new Address('01::FF:23');
      const address2 = new Address('::45:77');
      const empty = new Address('::0');
      expect(address).toHaveProperty('type', AddressType.mac);
      expect(address.mac && address.mac.equals(Buffer.from([1, 0, 0, 0, 255, 0x23]))).toBe(true);
      expect(address2.mac && address2.mac.equals(Buffer.from([0, 0, 0, 0, 0x45, 0x77]))).toBe(true);
      expect(empty).toHaveProperty('type', AddressType.empty);
    });

    test('should be array mac', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const mac = new Uint8Array(array);
      const address = new Address(mac);
      expect(address.mac && address.mac.equals(mac)).toBe(true);
      expect(address).toHaveProperty('type', AddressType.mac);
    });
  });

  describe('comparision', () => {
    const a = new Address('::45:78');
    const b = new Address([0, 0, 0, 0, 0x45, 0x78]);
    const c = new Address();
    const d = new Address('::45:79');
    test('should be equal', () => {
      expect(a.equals(b)).toBe(true);
      expect(a.equals(a)).toBe(true);
      expect(c.equals(Address.empty)).toBe(true);
      expect(a.equals(new Address(a))).toBe(true);
    });
    test('shouldn\'t be equal', () => {
      expect(a.equals(c)).toBe(false);
      expect(a.equals(d)).toBe(false);
    });
  });

  test('toString', () => {
    expect(new Address().toString()).toBe('::0');
    expect(Address.broadcast.toString()).toBe('FF:FF:FF:FF:FF:FF');
    expect(new Address('::12:3f').toString()).toBe('::12:3F');
    expect(new Address([1, 2, 3, 4, 5, 6]).toString()).toBe('01:02:03:04:05:06');
    expect(new Address('ff.0.1').toString()).toBe('255.0.1');
    expect(new Address('12.34').toString()).toBe('12.34');
  });
});
