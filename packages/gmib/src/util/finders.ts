/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable no-bitwise,no-await-in-loop */
import {
  SarpQueryType,
  Address,
  AddressType,
  NibusConnection,
  createSarp,
  SarpDatagram,
} from '@nibus/core';

import { delay, tuplify } from './helpers';
import Runnable from './Runnable';

export type DeviceInfo = {
  address: Address;
  connection: NibusConnection;
  version?: number;
  type: number;
};

export const toVersion = (ver: number): string => `${(ver >> 8) & 0xff}.${ver & 0xff}`;

type AddressListener = (info: DeviceInfo) => void;

export type FinderOptions = {
  address?: string;
  type?: number;
  connections?: NibusConnection[];
};

declare interface Finder extends Runnable<FinderOptions> {
  on(event: 'start', listener: () => void): this;
  on(event: 'finish', listener: () => void): this;
  on(event: 'found', listener: AddressListener): this;
  once(event: 'start', listener: () => void): this;
  once(event: 'finish', listener: () => void): this;
  once(event: 'found', listener: AddressListener): this;
  addListener(event: 'start', listener: () => void): this;
  addListener(event: 'finish', listener: () => void): this;
  addListener(event: 'found', listener: AddressListener): this;
  off(event: 'start', listener: () => void): this;
  off(event: 'finish', listener: () => void): this;
  off(event: 'found', listener: AddressListener): this;
  removeListener(event: 'start', listener: () => void): this;
  removeListener(event: 'finish', listener: () => void): this;
  removeListener(event: 'found', listener: AddressListener): this;
  emit(event: 'start'): boolean;
  emit(event: 'finish'): boolean;
  emit(event: 'found', info: DeviceInfo): boolean;
}

class Finder extends Runnable<FinderOptions> {
  protected async macFinder(address: Address, connections: NibusConnection[]): Promise<void> {
    let rest = connections.slice(0);
    let first = true;
    while (!this.isCanceled && rest.length > 0) {
      if (first) first = false;
      else await delay(1);
      const results = await Promise.all(rest.map(connection => connection.getVersion(address)));
      results
        .filter(tuple => tuple.length === 2)
        // eslint-disable-next-line no-loop-func
        .forEach(([version, type], index) =>
          this.emit('found', {
            address,
            version,
            type: type!,
            connection: rest[index],
          })
        );
      rest = rest.filter((_, index) => results[index].length === 0);
    }
  }

  protected async runImpl({ connections, type, address }: FinderOptions): Promise<void> {
    if (!connections) throw new Error('Invalid connections');
    const addr = new Address(address);
    let counter = 0;
    let createRequest: () => SarpDatagram;
    let queryType = SarpQueryType.All;
    if (type) {
      queryType = SarpQueryType.ByType;
      createRequest = () => createSarp(queryType, [0, 0, 0, (type! >> 8) & 0xff, type! & 0xff]);
    } else {
      switch (addr.type) {
        case AddressType.net:
          // Не реализовано, используем запрос по адресу
          // if (false) {
          //   queryType = SarpQueryType.ByNet;
          //   createRequest = () => createSarp(queryType, [...addr.raw.slice(0, 5)].reverse());
          //   break;
          // } else {
          this.macFinder(addr, connections);
          return;
        // }
        case AddressType.group:
          queryType = SarpQueryType.ByGrpup;
          createRequest = () => createSarp(queryType, [...addr.raw.slice(0, 5)].reverse());
          break;
        case AddressType.mac:
          this.macFinder(addr, connections);
          return;
        default:
          queryType = SarpQueryType.All;
          createRequest = () => createSarp(queryType, [0, 0, 0, 0, 0]);
          break;
      }
    }
    const createSarpListener = (
      connection: NibusConnection
    ): ((datagram: SarpDatagram) => void) => {
      const detected = new Set<string>();
      return (datagram: SarpDatagram) => {
        if (datagram.queryType !== queryType) return;
        if (queryType === SarpQueryType.ByType && datagram.deviceType !== type) return;
        const mac = new Address(datagram.mac);
        const key = mac.toString();
        if (detected.has(key)) return;
        counter = 0;
        detected.add(key);
        this.emit('found', {
          connection,
          address: mac,
          type: datagram.deviceType!,
        });
      };
    };
    let listeners: [NibusConnection, (datagram: SarpDatagram) => void][] = [];
    try {
      listeners = connections.map(connection => {
        const listener = createSarpListener(connection);
        connection.on('sarp', listener);
        return tuplify(connection, listener);
      });

      let first = true;

      while (!this.isCanceled && counter < 3) {
        if (first) first = false;
        else await delay(3);
        counter += 1;
        await Promise.all(connections.map(connection => connection.sendDatagram(createRequest())));
      }
    } finally {
      listeners.forEach(([connection, listener]) => connection.off('sarp', listener));
    }
  }
}

export default Finder;
