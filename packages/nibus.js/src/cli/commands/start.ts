import pm2, { StartOptions } from 'pm2';
import { CommandModule } from 'yargs';
import path from 'path';
import debugFactory from 'debug';

const debug = debugFactory('nibus:start');
// import { promisify } from 'util';

// const connect = promisify(pm2.connect);
// const start = promisify<StartOptions>(pm2.start);

export const startOptions: StartOptions = {
  name: 'nibus.service',
  script: 'service/demon.js',
  cwd: path.resolve(__dirname, '../..'),
  max_restarts: 3,
};

if (path.extname(__filename) === '.ts') {
  startOptions.script = 'service/dev.start.js';
  startOptions.watch = [
    'service/demon.ts',
    'ipc/Server.ts',
    'ipc/SerialTee.ts',
    'service/detector.ts',
  ];
}

const startCommand: CommandModule = {
  command: 'start',
  describe: 'запустить сервис NiBUS',
  builder: {},
  handler: () => {
    pm2.connect((err) => {
      if (err) {
        console.error('error while connect pm2', err.stack);
        process.exit(2);
      }
      debug('pm2 is connected');
      pm2.delete(startOptions.name!, () =>
        pm2.start(startOptions, (err) => {
          pm2.disconnect();
          if (err) {
            console.error('error while start nibus.service', err);
            process.exit(2);
          }
          debug('nibus.service was started');
        }));
    });
  },
};

export default startCommand;
