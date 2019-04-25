/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Address } from '@nata/nibus.js-client';
import { NibusConnection } from '@nata/nibus.js-client/lib/nibus';
import { delay } from './helpers';
import Runnable, { IRunnable } from './Runnable';

export type DeviceInfo = {
  address: Address,
  connection: NibusConnection,
  version: number,
  type: number,
};

export const toVersion = (ver: number) => `${(ver >> 8) & 0xFF}.${ver & 0xFF}`;

type AddressListener = (info: DeviceInfo) => void;

export type FinderOptions = {
  address?: string,
  connections?: NibusConnection[],
};

export interface IFinder extends IRunnable<FinderOptions> {
  on(event: 'start', listener: () => void): this;
  on(event: 'finish', listener: () => void): this;
  once(event: 'start', listener: () => void): this;
  once(event: 'finish', listener: () => void): this;
  addListener(event: 'start', listener: () => void): this;
  addListener(event: 'finish', listener: () => void): this;
  off(event: 'start', listener: () => void): this;
  off(event: 'finish', listener: () => void): this;
  removeListener(event: 'start', listener: () => void): this;
  removeListener(event: 'finish', listener: () => void): this;
  emit(event: 'start'): boolean;
  emit(event: 'finish'): boolean;
  on(event: 'found', listener: AddressListener): this;
  once(event: 'found', listener: AddressListener): this;
  addListener(event: 'found', listener: AddressListener): this;
  off(event: 'found', listener: AddressListener): this;
  removeListener(event: 'found', listener: AddressListener): this;
  emit(event: 'found', address: Address, connection: NibusConnection): boolean;
}

export class AddressFinder extends Runnable<FinderOptions> implements IFinder {
  $error?: string;

  get error() { return this.$error; }

  protected async runImpl({ address, connections }: FinderOptions) {
    if (!connections) throw new Error('Invalid connections');
    if (!address) throw new Error('Invalid address');
    let rest = connections.slice(0);
    while (!this.isCanceled) {
      const results = await Promise.all(rest.map(connection => connection.getVersion(address)));
      results
        .filter(tuple => tuple.length === 2)
        .forEach(([version, type], index) => this.emit(
          'found',
          {
            address,
            type,
            version,
            connection: rest[index],
          },
        ));
      rest = rest.filter((_, index) => results[index].length === 0);
      if (rest.length === 0) {
        this.emit('finish');
        break;
      }
      await delay(1);
    }
  }
}
