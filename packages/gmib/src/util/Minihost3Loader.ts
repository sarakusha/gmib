/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable no-bitwise */
import session from '@nibus/core';
import { DeviceId } from '../store/devicesSlice';
import MinihostLoader from './MinihostLoader';

type Vertex = { x: number; y: number };

// eslint-disable-next-line no-shadow
export enum Minihost3Selector {
  Temperature,
  Voltage1,
  Voltage2,
  Version,
  RedVertex,
  GreenVertex,
  BlueVertex,
}

export type Minihost3Info = {
  t?: number;
  v1?: number;
  v2?: number;
  MCU?: string;
  PLD?: string;
  redVertex?: Vertex;
  greenVertex?: Vertex;
  blueVertex?: Vertex;
};

export const initialSelectors = [
  Minihost3Selector.Temperature,
  Minihost3Selector.Voltage1,
  Minihost3Selector.Voltage2,
  Minihost3Selector.Version,
  Minihost3Selector.RedVertex,
  Minihost3Selector.GreenVertex,
  Minihost3Selector.BlueVertex,
] as const;

const digits = (len: number): ((val: number) => number) => {
  const dec = 10 ** len;
  return (val: number) => Math.round(val * dec) / dec;
};

const digits3 = digits(3);

// const digits3 = x => x;
const parseData = (info: Minihost3Info, selector: Minihost3Selector, data: Buffer): void => {
  switch (selector) {
    case Minihost3Selector.Temperature:
      info.t = data[2] / 2;
      if (data[3] & 1) {
        info.t -= 128;
      }
      return;
    case Minihost3Selector.Voltage1:
      info.v1 = data.readUInt16LE(2);
      return;
    case Minihost3Selector.Voltage2:
      info.v2 = data.readUInt16LE(2);
      return;
    case Minihost3Selector.Version:
      info.PLD = `${data[1]}.${data[0]}`;
      info.MCU = `${data[3]}.${data[2]}`;
      return;
    case Minihost3Selector.RedVertex:
      if (data[2] && data[3]) {
        info.redVertex = {
          x: digits3(640 / 1024 + data[3] / 2048),
          y: digits3(256 / 1024 + data[2] / 2048),
        };
      }
      break;
    case Minihost3Selector.GreenVertex:
      if (data[2] && data[3]) {
        info.greenVertex = {
          x: digits3(128 / 1024 + data[3] / 2048),
          y: digits3(640 / 1024 + data[2] / 2048),
        };
      }
      break;
    case Minihost3Selector.BlueVertex:
      if (data[2] && data[3]) {
        info.blueVertex = {
          x: digits3(64 / 1024 + data[3] / 2048),
          y: digits3(data[2] / 2048),
        };
      }
      break;
    default:
      throw new Error(`Unknown selector ${selector}`);
  }
};

export default class Minihost3Loader extends MinihostLoader<Minihost3Info> {
  selectorId: number;

  moduleSelectId: number;

  static readonly DOMAIN = 'MODUL';

  constructor(deviceId: DeviceId) {
    const device = session.devices.get().find(({ id }) => id === deviceId);
    if (!device) throw new Error(`Unknown device ${deviceId}`);
    super(device);
    this.selectorId = device.getId('selector');
    this.moduleSelectId = device.getId('moduleSelect');
  }

  async getInfo(x: number, y: number): Promise<Minihost3Info> {
    const { device, selectors = new Set(initialSelectors) } = this;
    const info: Minihost3Info = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const selector of selectors) {
      device.selector = selector;
      device.moduleSelect = ((x & 0xff) << 8) + (y & 0xff);
      // eslint-disable-next-line no-await-in-loop
      await device.write(this.selectorId, this.moduleSelectId);
      // eslint-disable-next-line no-await-in-loop
      const data = await device.upload(Minihost3Loader.DOMAIN, 0, 6);
      parseData(info, selector, data);
    }
    return info;
  }

  isInvertH(): boolean {
    return this.device.getRawValue('dirh') || false;
  }

  isInvertV(): boolean {
    return this.device.getRawValue('dirv') || false;
  }
}
