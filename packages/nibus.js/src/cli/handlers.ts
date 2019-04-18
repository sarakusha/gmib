/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Arguments, Defined } from 'yargs';
import { devices, IDevice } from '@nata/nibus.js-client/lib/mib';
import session, { Address } from '@nata/nibus.js-client';
import { getNibusTimeout, NibusConnection } from '@nata/nibus.js-client/lib/nibus';
import { CommonOpts } from './options';

// export type NibusCounter = (handler: (count: number) => number) => void;

interface ActionFunc<O> {
  (device: IDevice, args: Arguments<O>): Promise<void>;
}

const makeAddressHandler = <O extends Defined<CommonOpts, 'm' | 'mac'>>
(action: ActionFunc<O>, breakout = false) =>
  (args: Arguments<O>) =>
    new Promise(async (resolve, reject) => {
      let hasFound = false;
      const close = (err?: string) => {
        clearTimeout(timeout);
        session.close();
        if (err || !hasFound) {
          return reject(err || 'Устройство не найдено');
        }
        resolve();
      };
      const mac = new Address(args.mac);
      let count = await session.start();
      // На Windows сложнее метод определения и занимает больше времени
      if (process.platform === 'win32') {
        count *= 2;
      }
      // const setCount: NibusCounter = (handler = (c: number) => c) => count = handler(count);

      const perform = async (connection: NibusConnection, mibOrType: any, version?: number) => {
        clearTimeout(timeout);
        const device = devices.create(mac, mibOrType, version);
        device.connection = connection;
        await action(device, args);
        hasFound = true;
      };

      session.on('found', async ({ address, connection }) => {
        try {
          if (address.equals(mac) && connection.description.mib) {
            if (!args.mib || args.mib === connection.description.mib) {
              await perform(connection, connection.description.mib);
              if (breakout) return close();
              wait();
            }
          }
          if (address.equals(mac) && connection.description.type || connection.description.link) {
            count += 1;
            const [version, type] = await connection.getVersion(mac);
            if (type) {
              await perform(connection, type, version);
              if (breakout) return close();
              wait();
            }
          }
        } catch (e) {
          close(e.message || e);
        }
        count -= 1;
        if (count === 0) {
          clearTimeout(timeout);
          process.nextTick(close);
        }
      });

      const wait = () => {
        count -= 1;
        if (count > 0) {
          timeout = setTimeout(wait, getNibusTimeout());
        } else {
          close();
        }
      };

      let timeout = setTimeout(wait, getNibusTimeout());
    });

export { makeAddressHandler };
