/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import MinihostLoader from './MinihostLoader';

export type Minihost3Info = {
  t?: number,
  v1?: number,
  v2?: number,
  'MCU'?: string,
  'PLD'?: string,
};

const parseData = (info: Minihost3Info, selector: number, data: Buffer) => {
  switch (selector) {
    case 0:
      info.t = data[2] / 2;
      if (info.t > 127) {
        info.t -= 256;
      }
      return;
    case 1:
      info.v1 = data.readUInt16LE(2);
      return;
    case 2:
      info.v2 = data.readUInt16LE(2);
      return;
    case 3:
      info.PLD = `${data[1]}.${data[0]}`;
      info.MCU = `${data[3]}.${data[2]}`;
      return;
    default:
      throw new Error(`Unknown selector ${selector}`);
  }
};

export default class Minihost3Loader extends MinihostLoader<Minihost3Info> {
  selectorId: number;
  moduleSelectId: number;
  static readonly DOMAIN = 'MODUL';
  constructor(device: IDevice, readonly selectors = [0, 1, 2, 3]) {
    super(device);
    this.selectorId = device.getId('selector');
    this.moduleSelectId = device.getId('moduleSelect');

  }

  async getInfo(x: number, y: number): Promise<Minihost3Info> {
    const { device, selectors } = this;
    const info: Minihost3Info = {};
    for (const selector of selectors) {
      device.selector = selector;
      device.moduleSelect = ((x & 0xFF) << 8) + (y & 0xFF);
      await device.write(this.selectorId, this.moduleSelectId);
      const data = await device.upload(Minihost3Loader.DOMAIN, 0, 6);
      parseData(info, selector, data);
    }
    return info;
  }

  isInvertH(): boolean {
    return this.device.getRawValue('dirv') || false;
  }

  isInvertV(): boolean {
    return this.device.getRawValue('dirh') || false;
  }
}
