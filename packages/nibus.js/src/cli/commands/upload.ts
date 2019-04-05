/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Arguments, CommandModule, Defined } from 'yargs';
import fs from 'fs';
import path from 'path';
import Progress from 'progress';
import { EOL } from 'os';

import { IDevice } from '@nata/nibus.js-client/lib/mib';
import { UploadDataListener } from '@nata/nibus.js-client/lib/mib/devices';
import { printBuffer } from '@nata/nibus.js-client/lib/nibus/helper';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';
import { action as writeAction } from './write';

type UploadOpts = Defined<CommonOpts, 'mac' | 'm'> & {
  domain: string,
  offset: number,
  size?: number,
  o?: string,
  out?: string,
  hex?: boolean,
  f?: boolean,
  force?: boolean,
};

export async function action(device: IDevice, args: Arguments<UploadOpts>) {
  const { domain, offset, size, out, force, hex, quiet } = args;
  const writeArgs = out
    ? {
      ...args,
      quiet: true,
    }
    : args;
  await writeAction(device, writeArgs);
  let close = () => {};
  let write: (data: any) => void;
  let tick = (size: number) => {};

  if (out) {
    if (!force && fs.existsSync(out)) {
      throw new Error(`File ${path.resolve(out)} already exists`);
    }
    const ws = fs.createWriteStream(out, {
      encoding: hex ? 'utf8' : 'binary',
    });
    write = data => ws.write(data, err => err && console.error(err.message));
    close = ws.close.bind(ws);
  } else {
    write = data => process.stdout.write(data, err => err && console.error(err.message));
  }
  const dataHandler: UploadDataListener = ({ data }) => {
    tick(data.length);
    if (hex) {
      write(`${printBuffer(data)}${EOL}`);
    } else {
      write(data);
    }
  };

  device.once('uploadStart', ({ domainSize }) => {
    const total = size || (domainSize - offset);
    if (out) {
      const bar = new Progress(
        `  uploading [:bar] ${total! <= 50 ? '' : ':rate/bps :percent '}:current/:total :etas`,
        {
          total: total!,
          width: 20,
        },
      );
      tick = bar.tick.bind(bar);
    }
    if (hex && offset > 0) {
      write(`@${offset.toString(16).padStart(4, '0')}${EOL}`);
//       write(`DOMAIN: ${domain}
// OFFSET: ${offset}
// SIZE: ${total!}
// `);
    }
  });
  device.on('uploadData', dataHandler);

  try {
    await device.upload(domain, offset, size);
  } finally {
    device.off('uploadData', dataHandler);
    close();
  }
}

const uploadCommand: CommandModule<CommonOpts, UploadOpts> = {
  command: 'upload',
  describe: 'выгрузить домен из устройства',
  builder: argv =>
    argv
      .option('domain', {
        default: 'CODE',
        describe: 'имя домена',
        string: true,
      })
      .option('offset', {
        alias: 'ofs',
        default: 0,
        number: true,
        describe: 'смещение в домене',
      })
      .option('size', {
        alias: 'length',
        number: true,
        describe: 'требуемое количество байт',
      })
      .option('out', {
        alias: 'o',
        string: true,
        describe: 'сохранить в файл',
      })
      .option('hex', {
        boolean: true,
        describe: 'использовать текстовый формат',
      })
      .option('f', {
        alias: 'force',
        boolean: true,
        describe: 'перезаписать существующий файл',
      })
      .demandOption(['m', 'mac', 'domain']),
  handler: makeAddressHandler(action, true),
};

export default uploadCommand;
