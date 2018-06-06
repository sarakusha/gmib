import Address from './address';

describe('Address', () => {
  describe('constructor', () => {
    test('should be empty', () => {
      const empty = new Address();
      expect(empty).toHaveProperty('type', 'empty');
      expect(empty.isEmpty).toBe(true);
      expect(new Address(empty.toString())).toHaveProperty('isEmpty', true);
    });

    test('should be hex net', () => {
      const net = expect(new Address('FE.56.34'));
      net.toHaveProperty('type', 'net');
      net.toHaveProperty('domain', 0xFE);
      net.toHaveProperty('subnet', 0x56);
      net.toHaveProperty('device', 0x34);
    });

    test('should be group', () => {
      const group = expect(new Address('255.128'));
      group.toHaveProperty('domain', 255);
      group.toHaveProperty('group', 128);
      group.toHaveProperty('type', 'group');
    });

    test('should be string mac', () => {
      const address = new Address('01::FF:23');
      expect(address).toHaveProperty('type', 'mac');
      expect(address.mac.equals(Buffer.from([1, 0, 0, 0, 255, 0x23]))).toBeTruthy();
      expect(new Address('::45:77').mac.equals(Buffer.from([0, 0, 0, 0, 0x45, 0x77]))).toBeTruthy();
      expect(new Address('::0')).toHaveProperty('type', 'empty');
    });

    test('should be array mac', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const mac = new Uint8Array(array);
      const address = new Address(mac);
      expect(address.mac.equals(mac)).toBe(true);
      expect(address).toHaveProperty('type', 'mac');
      expect(new Address(array).mac.equals(mac)).toBe(true);
    });
  });

  describe('comparision', () => {
    const a = new Address('::45:78');
    const b = new Address([0, 0, 0, 0, 0x45, 0x78]);
    const c = new Address();
    const d = new Address('::45:79');
    test('should be equal', () => {
      expect(a.isEqual(b)).toBe(true);
      expect(a.isEqual(a)).toBe(true);
      expect(c.isEqual(Address.empty)).toBe(true);
      expect(a.isEqual(new Address(a))).toBe(true);
    });
    test('shouldn\'t be equal', () => {
      expect(a.isEqual(c)).toBe(false);
      expect(a.isEqual(d)).toBe(false);
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

