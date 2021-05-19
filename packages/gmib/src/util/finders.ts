/*
 * @license
 * Copyright (c) 2021. Nata-Info
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
  INibusConnection,
  createSarp,
  SarpDatagram,
  DeviceId,
  findDeviceById,
} from '@nibus/core';

import { delay, notEmpty, tuplify } from './helpers';
import Runnable, { RunnableEvents } from './Runnable';
import debugFactory from './debug';

const debug = debugFactory('gmib:finder');

export type DeviceInfo = {
  address: Address;
  owner: DeviceId | undefined;
  version?: number;
  type: number;
};

export const toVersion = (ver: number): string => `${(ver >> 8) & 0xff}.${ver & 0xff}`;

export type FinderOptions = {
  address?: string;
  type?: number;
  owners: DeviceId[];
};

interface FinderEvents extends RunnableEvents {
  found: (info: DeviceInfo) => void;
}

const getConnection = (owner: DeviceId): INibusConnection | undefined => {
  const device = findDeviceById(owner);
  if (!device) {
    debug(`Unknown device ${owner}`);
    return undefined;
  }
  const { connection, address: ownerAddress } = device;
  if (!connection) {
    debug(`Device ${ownerAddress} not connected`);
    return undefined;
  }
  if (connection.owner !== device) {
    debug(`Device ${ownerAddress} does not own the connection`);
    return undefined;
  }
  return connection;
};

const isOwner = (connection: INibusConnection, address: Address): boolean => {
  const { owner } = connection;
  if (!owner || (address.type !== AddressType.net && !address.equals(owner.address))) return false;
  const mib: string = Reflect.getMetadata('mib', owner);
  return (
    mib?.startsWith('minihost') && address.equals(`${owner.domain}.${owner.subnet}.${owner.did}`)
  );
};

class Finder extends Runnable<FinderOptions, FinderEvents> {
  protected async macFinder(address: Address, connections: INibusConnection[]): Promise<void> {
    let rest = connections.filter(connection => !isOwner(connection, address));
    let first = true;
    while (this.isRunning && !this.isCanceled && rest.length > 0) {
      if (first) first = false;
      else await delay(1);
      const results = await Promise.all(
        rest.map(async connection => tuplify(await connection.getVersion(address), connection))
      );
      results.forEach(
        ([response, connection]) =>
          response &&
          this.emit('found', {
            address,
            version: response.version,
            type: response.type,
            owner: connection.owner?.id,
          })
      );
      rest = results
        .filter(([response]) => response === undefined)
        .map(([, connection]) => connection);
    }
  }

  protected async runImpl({ owners, type, address }: FinderOptions): Promise<void> {
    const connections = owners.map(getConnection).filter(notEmpty);
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
          await this.macFinder(addr, connections);
          return;
        // }
        case AddressType.group:
          queryType = SarpQueryType.ByGroup;
          createRequest = () => createSarp(queryType, [...addr.raw.slice(0, 5)].reverse());
          break;
        case AddressType.mac:
          await this.macFinder(addr, connections);
          return;
        default:
          queryType = SarpQueryType.All;
          createRequest = () => createSarp(queryType, [0, 0, 0, 0, 0]);
          break;
      }
    }
    const createSarpListener = (
      connection: INibusConnection
    ): ((datagram: SarpDatagram) => void) => {
      const detected = new Set<string>(
        connections
          .map(({ owner }) => owner)
          .filter(notEmpty)
          .map(({ address: ownerAddress }) => ownerAddress.toString())
      );
      return async (datagram: SarpDatagram) => {
        if (datagram.queryType !== queryType) return;
        if (queryType === SarpQueryType.ByType && datagram.deviceType !== type) return;
        const mac = new Address(datagram.mac);
        const key = mac.toString();
        if (detected.has(key)) return;
        const info = await connection.getVersion(mac);
        counter = 0;
        detected.add(key);
        this.emit('found', {
          owner: connection.owner?.id,
          address: mac,
          version: info?.version,
          type: datagram.deviceType!,
        });
      };
    };
    let listeners: [INibusConnection, (datagram: SarpDatagram) => void][] = [];
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
