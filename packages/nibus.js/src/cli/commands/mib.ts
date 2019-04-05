/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { PathReporter } from 'io-ts/lib/PathReporter';
import { CommandModule } from 'yargs';
import path from 'path';
import { convert, MibDeviceV } from '@nata/nibus.js-client/lib/mib';

const mibCommand: CommandModule = {
  command: 'mib <mibfile>',
  describe: 'добавить mib-файл',
  builder: argv => argv
    .positional('mibfile', {
      describe: 'путь к mib-файлу',
      type: 'string',
    })
    .demandOption('mibfile'),
  handler: async ({ mibfile }) => {
    const dest = path.resolve(__dirname, '../../../mibs');
    await convert(mibfile as string, dest);
    const validation = MibDeviceV.decode(require(dest));
    if (validation.isLeft()) {
      throw new Error(`Invalid mib file: ${mibfile}
      ${PathReporter.report(validation)}`);
    }
  },
};

export default mibCommand;
