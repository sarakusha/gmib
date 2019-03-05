import { Arguments, Defined } from 'yargs';
import Address from '../Address';
import { getNibusTimeout, NibusConnection } from '../nibus';
import session from '../service';
import { CommonOpts } from './options';

// export type NibusCounter = (handler: (count: number) => number) => void;

interface ActionFunc<O> {
  (
    // setCount: NibusCounter,
    args: Arguments<O>,
    address: Address,
    connection: NibusConnection,
    mib?: string): Promise<void>;

  (
    // setCount: NibusCounter,
    args: Arguments<O>,
    address: Address,
    connection: NibusConnection,
    type: number): Promise<void>;
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
      // const setCount: NibusCounter = (handler = (c: number) => c) => count = handler(count);

      session.on('found', async ({ address, connection }) => {
        try {
          if (address.equals(mac)) {
            if (!args.mib || args.mib === connection.description.mib) {
              clearTimeout(timeout);
              await action(args, mac, connection, connection.description.mib!);
              hasFound = true;
              if (breakout) return close();
            }
          }
          if (connection.description.link) {
            count += 1;
            if (args.fw) {
              const [, type] = await connection.getFirmwareVersion(mac);
              if (type) {
                clearTimeout(timeout);
                await action(args, mac, connection, type);
                hasFound = true;
                if (breakout) return close();
              }
            } else {
              clearTimeout(timeout);
              const ping = await connection.ping(mac);
              if (ping !== -1) {
                await action(args, mac, connection, args.mib);
                hasFound = true;
                if (breakout) return close();
              }
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
