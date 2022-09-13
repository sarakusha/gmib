/* eslint-disable no-await-in-loop,no-bitwise */
import debugFactory from 'debug';

import type { RunnableEvents } from './Runnable';
import Runnable from './Runnable';

import type { DeviceId, INibusConnection, SarpDatagram } from '@nibus/core';
import { findDeviceById } from '@nibus/core';
import Address, { AddressType } from '@nibus/core/Address';
import { createSarp, SarpQueryType } from '@nibus/core/sarp';

import type { DeviceInfo } from '/@renderer/store/sessionSlice';
import type { FinderOptions } from '/@common/helpers';
import { delay, notEmpty, tuplify } from '/@common/helpers';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:finder`);

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

export default class Finder extends Runnable<FinderOptions, FinderEvents> {
  protected async macFinder(address: Address, connections: INibusConnection[]): Promise<void> {
    let rest = connections.filter(connection => !isOwner(connection, address));
    let first = true;
    while (this.isRunning && !this.isCanceled && rest.length > 0) {
      if (first) first = false;
      else await delay(1);
      const results = await Promise.all(
        rest.map(async connection => tuplify(await connection.getVersion(address), connection)),
      );
      results.forEach(
        ([response, connection]) =>
          response &&
          this.emit('found', {
            address: address.toString(),
            version: response.version,
            type: response.type,
            owner: connection.owner?.id,
          }),
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
      createRequest = () => createSarp(queryType, [0, 0, 0, (type >> 8) & 0xff, type & 0xff]);
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
      connection: INibusConnection,
    ): ((datagram: SarpDatagram) => void) => {
      const detected = new Set<string>(
        connections
          .map(({ owner }) => owner)
          .filter(notEmpty)
          .map(({ address: ownerAddress }) => ownerAddress.toString()),
      );
      return async (datagram: SarpDatagram) => {
        if (datagram.queryType !== queryType) return;
        const { deviceType } = datagram;
        if (!deviceType || (queryType === SarpQueryType.ByType && deviceType !== type)) return;
        const mac = new Address(datagram.mac);
        const key = mac.toString();
        if (detected.has(key)) return;
        const info = await connection.getVersion(mac);
        counter = 0;
        detected.add(key);
        this.emit('found', {
          owner: connection.owner?.id,
          address: key,
          version: info?.version,
          type: deviceType,
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
