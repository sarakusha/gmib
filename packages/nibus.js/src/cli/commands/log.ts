import { CommandModule } from 'yargs';
import debugFactory from 'debug';
import { Tail } from 'tail';
import path from 'path';
import { homedir } from 'os';
import { PATH } from '../../service/const';
import { Client } from '../../ipc';

const debug = debugFactory('nibus:log');
const logCommand: CommandModule = {
  command: 'log',
  describe: 'задать уровень логгирования',
  builder: argv => argv
    .option('level', {
      alias: ['l', 'lev'],
      desc: 'уровень',
      choices: ['none', 'hex', 'nibus'],
      default: 'none',
    })
    .option('pick', {
      desc: 'выдавать указанные поля в логах nibus',
      array: true,
    })
    .option('omit', {
      desc: 'выдавть поля кроме указанных в логах nibus',
      array: true,
    })
    .option('begin', {
      alias: 'b',
      describe: 'вывод с начала',
      boolean: true,
    }),
  handler: ({ level, pick, omit, begin }) => new Promise((resolve, reject) => {
    const socket = Client.connect(PATH);
    let resolved = false;
    socket.once('close', () => {
      resolved ? resolve() : reject();
    });
    socket.on('error', (err) => {
      debug('<error>', err);
    });
    socket.on('connect', async () => {
      try {
        await socket.send('setLogLevel', level, pick, omit);
        resolved = true;
      } catch {}
      socket.destroy();
    });
    const log = new Tail(path.resolve(
      homedir(),
      '.pm2',
      'logs',
      'nibus.service-error.log',
    ), { fromBeginning: !!begin });
    process.on('SIGINT', () => log.unwatch());
    log.watch();
    log.on('line', console.log);
  }),
};

export default logCommand;
