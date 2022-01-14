/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable no-bitwise */
import { DeviceId, findDeviceById } from '@nibus/core';
import MinihostLoader from './MinihostLoader';

export type Minihost2Info = {
  t?: number;
  ver?: string;
};

function getFraction(byte: number): number {
  let two = 2;
  let fraction = 0;
  let test;
  for (let i = 0; i < 4; i += 1, two *= 2) {
    test = 1 << (7 - i);
    // noinspection JSBitwiseOperatorUsage
    if (byte & test) {
      fraction += 1 / two;
    }
  }
  return fraction;
}

export default class Minihost2Loader extends MinihostLoader<Minihost2Info> {
  static readonly DOMAIN = 'MODUL';

  constructor(deviceId: DeviceId) {
    const device = findDeviceById(deviceId);
    if (!device) throw new Error(`Unknown device ${deviceId}`);
    super(device);
  }

  async getInfo(x: number, y: number): Promise<Minihost2Info> {
    const { device } = this;
    device.epcsH = x;
    device.epcsV = y;
    await device.drain();
    const info: Minihost2Info = {};
    const data = await device.upload(Minihost2Loader.DOMAIN, 0, 4);
    let t = data[2];
    if (t > 127) {
      t -= 256 + getFraction(data[3]);
    } else {
      t += getFraction(data[3]);
    }
    info.t = Math.round(t * 10) / 10;
    info.ver = `${data[0]}.${data[1]}`;
    return info;
  }

  isInvertH(): boolean {
    return this.device.getRawValue('hinvert') || false;
  }

  isInvertV(): boolean {
    return this.device.getRawValue('vinvert') || false;
  }
}
