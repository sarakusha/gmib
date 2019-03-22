import { PathReporter } from 'io-ts/lib/PathReporter';
import { CommandModule } from 'yargs';
import path from 'path';
import { convert, MibDeviceV } from '../../mib';

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
