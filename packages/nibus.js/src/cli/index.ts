import yargs from 'yargs';
import list from './list';

const argv = yargs
  .options('m', {
    alias: 'mac',
    desc: 'Адрес устройства',
    type: 'string',
  })
  .command(list)
  .help()
  .argv;
