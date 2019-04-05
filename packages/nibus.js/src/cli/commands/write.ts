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

type WriteOpts = Defined<CommonOpts, 'mac' | 'm'>;

type NameIdValue = [string, number, string];

export async function action(device: IDevice, args: Arguments<WriteOpts>) {
  const vars: NameIdValue[] = args._
    .slice(1)
    .map(arg => arg.split('=', 2))
    .filter(([name, value]) => name !== '' && value !== '')
    .map(([name, value]) => [device.getName(name), device.getId(name), value] as NameIdValue);
  vars.forEach(([name, , value]) => {
    device[name] = value;
  });
  if (vars.length === 0) {
    return;
  }
  args.quiet || console.log(`Writing to ${Reflect.getMetadata('mib', device)} [${device.address}]`);
  return device.write(...vars.map(([, id]) => id)).then((ids) => {
    if (args.quiet) return;
    ids.map(id => device.getName(id))
      .forEach(name => console.log(` - ${name} = ${JSON.stringify(device[name])}`));
  });
}

const writeCommand: CommandModule<CommonOpts, WriteOpts> = {
  command: 'write',
  describe: 'запись переменных в устройство',
  builder: argv => argv
    .demandOption(['mac', 'm'])
    .example(
      '$0 write -m ::ab:cd hofs=100 vofs=300 brightness=34',
      `записать в переменные: hofs<-100, vofs<-300, brightness<-34 на устройстве с адресом ::ab:cd
      mib указывать не обязательно, если у устройства есть firmware_version`,
    ),
  handler: makeAddressHandler(action, true),
};

export default writeCommand;
