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

import { IDevice } from '@nata/nibus.js-client/lib/mib';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

type ReadOpts = Defined<CommonOpts, 'id' | 'name' | 'm' | 'mac'>;

export async function action(device: IDevice, args: Arguments<ReadOpts>) {
  const idOrName = args.id[0];
  if (idOrName) {
    const id = device.getId(idOrName);
    const value = Object.values(await device.read(id))[0];
    if (value.error) throw new Error(value.error);
    args.quiet || console.log(JSON.stringify(args.raw ? device.getRawValue(id) : value));
  }
}

const readCommand: CommandModule<CommonOpts, ReadOpts> = {
  command: 'read',
  describe: 'прочитать значение переменной',
  builder: argv => argv
    .demandOption(['id', 'name', 'mac', 'm'])
    .check((argv) => {
      if (Array.isArray(argv.id) && argv.id.length !== 1) {
        throw 'Только одна переменная id за раз';
      }
      return true;
    }),
  handler: makeAddressHandler(action, true),
};

export default readCommand;
