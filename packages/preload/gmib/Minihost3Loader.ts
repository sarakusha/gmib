/* eslint-disable no-bitwise */
import MinihostLoader from './MinihostLoader';

import type { DeviceId } from '@nibus/core';
import { findDeviceById } from '@nibus/core';

import type { Minihost3Info } from '/@common/helpers';
import { getEnumValues, Minihost3Selector } from '/@common/helpers';

const digits = (len: number): ((val: number) => number) => {
  const dec = 10 ** len;
  return (val: number) => Math.round(val * dec) / dec;
};

const digits3 = digits(3);

const parseData = (
  acc: Minihost3Info,
  selector: Minihost3Selector,
  data: Buffer,
): Minihost3Info => {
  switch (selector) {
    case Minihost3Selector.Temperature: {
      let t = data[2] / 2;
      if (data[3] & 1) {
        t -= 128;
      }
      return { ...acc, t };
    }
    case Minihost3Selector.Voltage1:
      return { ...acc, v1: data.readUInt16LE(2) };
    case Minihost3Selector.Voltage2:
      return { ...acc, v2: data.readUInt16LE(2) };
    case Minihost3Selector.Version:
      return {
        ...acc,
        PLD: `${data[1]}.${data[0]}`,
        MCU: `${data[3]}.${data[2]}`,
      };
    case Minihost3Selector.RedVertex:
      if (data[2] && data[3]) {
        return {
          ...acc,
          redVertex: {
            x: digits3(640 / 1024 + data[3] / 2048),
            y: digits3(256 / 1024 + data[2] / 2048),
          },
        };
      }
      break;
    case Minihost3Selector.GreenVertex:
      if (data[2] && data[3]) {
        return {
          ...acc,
          greenVertex: {
            x: digits3(128 / 1024 + data[3] / 2048),
            y: digits3(640 / 1024 + data[2] / 2048),
          },
        };
      }
      break;
    case Minihost3Selector.BlueVertex:
      if (data[2] && data[3]) {
        return {
          ...acc,
          blueVertex: {
            x: digits3(64 / 1024 + data[3] / 2048),
            y: digits3(data[2] / 2048),
          },
        };
      }
      break;
    default:
      throw new Error(`Unknown selector ${selector}`);
  }
  return acc;
};

export default class Minihost3Loader extends MinihostLoader<Minihost3Info> {
  static readonly DOMAIN = 'MODUL';

  selectorId: number;

  moduleSelectId: number;

  constructor(deviceId: DeviceId) {
    const device = findDeviceById(deviceId);
    if (!device) throw new Error(`Unknown device3 ${deviceId}`);
    super(device);
    this.selectorId = device.getId('selector');
    this.moduleSelectId = device.getId('moduleSelect');
  }

  async getInfo(x: number, y: number): Promise<Minihost3Info> {
    const { device, selectors = new Set(getEnumValues(Minihost3Selector)) } = this;
    let info: Minihost3Info = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const selector of selectors) {
      device.selector = selector;
      device.moduleSelect = ((x & 0xff) << 8) + (y & 0xff);
      // eslint-disable-next-line no-await-in-loop
      await device.write(this.selectorId, this.moduleSelectId);
      // eslint-disable-next-line no-await-in-loop
      const data = await device.upload(Minihost3Loader.DOMAIN, 0, 6);
      info = parseData(info, selector, data);
    }
    return info;
  }

  isInvertH(): boolean {
    return this.device.getRawValue('dirh') || false;
  }

  isInvertV(): boolean {
    return !this.device.getRawValue('dirv');
  }
}
