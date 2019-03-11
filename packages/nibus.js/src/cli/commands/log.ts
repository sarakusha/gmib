import { CommandModule } from 'yargs';
import debugFactory from 'debug';
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
    }),
  handler: ({ level, pick, omit }) => new Promise((resolve, reject) => {
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

  }),
};

export default logCommand;
