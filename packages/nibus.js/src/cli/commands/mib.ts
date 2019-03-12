import { CommandModule } from 'yargs';
import path from 'path';
import { convert } from '../../mib';

const mibCommand: CommandModule = {
  command: 'mib <mibfile>',
  describe: 'добавить mib-файл',
  builder: argv => argv
    .positional('mibfile', {
      describe: 'путь к mib-файлу',
      type: 'string',
    })
    .demandOption('mibfile'),
  handler: ({ mibfile }) => {
    return convert(mibfile as string, path.resolve(__dirname, '../../../mibs'));
  },
};

export default mibCommand;
