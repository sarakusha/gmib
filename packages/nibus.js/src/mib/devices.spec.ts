import 'reflect-metadata';
import devices from './devices';
import { getMibs } from './mib2json';

describe('Device', () => {
  test('one mib - one prototype', () => {
    const device1 = devices.create('::34:56', 'mcdvi');
    const device2 = devices.create('::11:22', 'mcdvi');
    const device3 = devices.create('::66:77', 'siolynx');
    expect(Reflect.getPrototypeOf(device1)).toBe(Reflect.getPrototypeOf(device2));
    expect(Reflect.getPrototypeOf(device1)).not.toBe(Reflect.getPrototypeOf(device3));
    // console.log('json', JSON.stringify(device2));
  });
  test('has version property', () => {
    const device = devices.create('auto', 'siolynx');
    expect(device.getId('2')).toBe(device.getId('version'));
    expect(device.getId('cdata')).toBe(271);
  });
  test('different properties', () => {
    const device1 = devices.create('::34:56', 'mcdvi');
    const device2 = devices.create('::11:22', 'mcdvi');
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
    const device1 = devices.create(address, 'mcdvi');
    const device2 = devices.create(address, 'mcdvi');
    device1.brightness = 56;
    expect(device2).toHaveProperty('brightness', 56);
    expect(device1).toBe(device2);
  });
  test('countRef', () => {
    const address = 'FF:FE:00:34:56:78';
    const count = Object.keys(devices.get()).length;
    const device1 = devices.create(address, 'mcdvi');
    const device2 = devices.create(address, 'mcdvi');
    expect(devices.get().length).toBe(count + 1);
    device2.release();
    expect(devices.get().length).toBe(count + 1);
    device1.release();
    expect(devices.get().length).toBe(count);
  });
  test('mibs', async () => {
    const mibs = await getMibs();
    expect(mibs.length).toBeGreaterThanOrEqual(43);
  });
});
