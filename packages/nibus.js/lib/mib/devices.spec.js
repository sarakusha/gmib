"use strict";

var _devices = _interopRequireDefault(require("./devices"));

var _mib2json = require("./mib2json");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import 'reflect-metadata';
describe('Device', () => {
  test('one mib - one prototype', () => {
    const device1 = _devices.default.create('::34:56', 'mcdvi');

    const device2 = _devices.default.create('::11:22', 'mcdvi');

    const device3 = _devices.default.create('::66:77', 'siolynx');

    expect(Reflect.getPrototypeOf(device1)).toBe(Reflect.getPrototypeOf(device2));
    expect(Reflect.getPrototypeOf(device1)).not.toBe(Reflect.getPrototypeOf(device3)); // console.log('json', JSON.stringify(device2));
  });
  test('has version property', () => {
    const device = _devices.default.create('auto', 'siolynx');

    expect(device.getId('2')).toBe(device.getId('version'));
    expect(device.getId('cdata')).toBe(271);
  });
  test('different properties', () => {
    const device1 = _devices.default.create('::34:56', 'mcdvi');

    const device2 = _devices.default.create('::11:22', 'mcdvi');

    device1.brightness = 100;
    device2.brightness = 50;
    expect(device1).toHaveProperty('brightness', 100);
    expect(device1.getRawValue('brightness')).toBe(255);
    expect(device1.isDirty('brightness')).toBe(true);
    expect(device1.isDirty('version')).toBe(false);
    expect(device2).toHaveProperty('brightness', 50);
  });
  test('equal devices', () => {
    const address = 'FF:FE:12:34:56:78';

    const device1 = _devices.default.create(address, 'mcdvi');

    const device2 = _devices.default.create(address, 'mcdvi');

    device1.brightness = 56;
    expect(device2).toHaveProperty('brightness', 56);
    expect(device1).toBe(device2);
  });
  test('countRef', () => {
    const address = 'FF:FE:00:34:56:78';
    const count = Object.keys(_devices.default.get()).length;

    const device1 = _devices.default.create(address, 'mcdvi');

    const device2 = _devices.default.create(address, 'mcdvi');

    expect(_devices.default.get().length).toBe(count + 1);
    device2.release();
    expect(_devices.default.get().length).toBe(count + 1);
    device1.release();
    expect(_devices.default.get().length).toBe(count);
  });
  test('mibs', async () => {
    const mibs = await (0, _mib2json.getMibs)();
    expect(mibs.length).toBeGreaterThanOrEqual(43);
  });
});