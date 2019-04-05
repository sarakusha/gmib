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

type ExecuteOpts = Defined<CommonOpts, 'm' | 'mac'> & {
  program: string,
};

type NameValue = [string, string];

async function action(device: IDevice, args: Arguments<ExecuteOpts>) {
  const vars: NameValue[] = args._
    .slice(1)
    .map(arg => arg.split('=', 2) as NameValue)
    .filter(([name, value]) => name !== '' && value !== '');

  const opts = vars.reduce((res, [name, value]) => {
    res[name] = value;
    return res;
  }, {} as Record<string, string>);

  await device.execute(args.program, opts);
}

const executeCommand: CommandModule<CommonOpts, ExecuteOpts> = {
  command: 'execute <program>',
  aliases: 'exec',
  describe: 'выполнить подпрограмму',
  builder: argv => argv
    .positional('program', {
      describe: 'название подпрограммы',
      type: 'string',
    })
    .example('$0 execute signal duration=30 source=1 -m 45:33', 'выполнить программу signal с' +
      ' параметрами duration и source')
    .demandOption(['mac', 'm', 'program']),
  handler: makeAddressHandler(action, true),
};

export default executeCommand;
