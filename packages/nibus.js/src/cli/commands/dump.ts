/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import chalk from 'chalk';
import Table, { HorizontalTable } from 'cli-table3';
import _ from 'lodash';
import { Arguments, CommandModule } from 'yargs';
import debugFactory from 'debug';

import session, { Address } from '@nata/nibus.js-client';
import { CommonOpts } from '../options';
import { devices, getMibPrototype, IDevice } from '@nata/nibus.js-client/lib/mib';
import { getNibusTimeout, NibusConnection } from '@nata/nibus.js-client/lib/nibus';
import { SarpQueryType } from '@nata/nibus.js-client/lib/sarp';

type RowType = {
  displayName: string,
  value: any,
  key: string,
};

const debug = debugFactory('nibus:dump');
let count = 0;

async function dumpDevice(
  address: Address,
  connection: NibusConnection,
  argv: Arguments<DumpOpts>,
  mib?: string): Promise<void> {
  const raw = argv.raw;
  const compact = argv.compact;

  let device: IDevice;
  if (!mib) {
    const [version, type] = await connection.getVersion(address);
    device = devices.create(address, type!, version);
  } else {
    device = devices.create(address, mib);
  }
  device.connection = connection;
  let ids: number[] = [];
  if (argv.name) {
    ids = argv.name.map(name => device.getId(name));
  }
  const result: any = await device.read(...ids);
  const rows: RowType[] = Object.keys(result)
    .map((key) => {
      const value = raw ? device.getError(key) || device.getRawValue(key) : result[key];
      return {
        value,
        key,
        displayName: Reflect.getMetadata('displayName', device, key),
      };
    });
  const proto = Reflect.getPrototypeOf(device);
  device.release();
  const categories = _.groupBy(
    rows,
    ({ key }) => Reflect.getMetadata('category', proto, key) || '',
  );
  console.info(` Устройство ${Reflect.getMetadata('mib', proto)} [${address.toString()}]`);
  const table = new Table({
    head: ['Название', 'Значение', 'Имя'],
    style: { compact },
    wordWrap: true,
  }) as HorizontalTable;
  const toRow = ({ displayName, value, key }: RowType) => {
    let val;
    if (value && value.error) {
      val = chalk.red(value.error);
    } else if (value && value.errcode) {
      val = chalk.red(`errcode: ${value.errcode}`);
    } else {
      val = JSON.stringify(value);
      if (!Reflect.getMetadata('isWritable', proto, key)) {
        val = chalk.grey(val);
      }
    }
    return [displayName, val, key];
  };
  Object.keys(categories).forEach((category) => {
    const rows = categories[category] as RowType[];
    if (category) {
      table.push([{
        colSpan: 3,
        content: chalk.yellow(category.toUpperCase()),
      }]);
    }
    table.push(...rows.map(toRow));
  });
  console.info(table.toString());
}

function findDevices(mib: string, connection: NibusConnection, argv: Arguments<DumpOpts>) {
  count += 1;
  const proto = getMibPrototype(mib);
  const type = Reflect.getMetadata('deviceType', proto) as number;
  connection.findByType(type).catch(e => debug('error while findByType', e.stack));
  connection.on('sarp', (datagram) => {
    count += 1;
    if (datagram.queryType !== SarpQueryType.ByType) return;
    const responseType = datagram.queryParam.readUInt16BE(3);
    // const item = types.find(({ type }) => responseType === type);
    if (responseType !== type) return;
    const address = new Address(datagram.mac);
    dumpDevice(address, connection, argv, mib).catch(
      // () => {},
      e => console.error('error while dump:', e.message),
    );
  });
}

type DumpOpts = CommonOpts;

const dumpCommand: CommandModule<CommonOpts, DumpOpts> = {
  command: 'dump',
  describe: 'Выдать дампы устройств',
  builder: argv => argv
    .check((argv) => {
      if (argv.id && (!argv.mac && !argv.mib)) {
        throw `Данный аргумент требует следующий дополнительный аргумент:
 id -> mib или id -> mac`;
      }
      return true;
    }),
  handler: argv => new Promise(async (resolve, reject) => {
    const close = (err?: string) => {
      clearTimeout(timeout);
      session.close();
      if (err) reject(err); else resolve();
    };
    const mac = argv.mac && new Address(argv.mac);
    count = await session.start();
    // На Windows сложнее метод определения и занимает больше времени
    if (process.platform === 'win32') {
      count *= 2;
    }
    session.on('found', async ({ address, connection }) => {
      try {
        if (connection.description.link) {
          if (mac) {
            count += 1;
            await dumpDevice(mac, connection, argv);
          } else if (argv.mib) {
            findDevices(argv.mib!, connection, argv);
          }
        }
        if ((!mac || mac.equals(address))
          && (!argv.mib || argv.mib === connection.description.mib)) {
          await dumpDevice(address, connection, argv, connection.description.mib);
        }
        count -= 1;
        if (count === 0) {
          clearTimeout(timeout);
          process.nextTick(close);
        }
      } catch (e) {
        close(e.message || e);
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
  }),
};

export default dumpCommand;
