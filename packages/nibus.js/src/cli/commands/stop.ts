import pm2 from 'pm2';
import { CommandModule } from 'yargs';
import debugFactory from 'debug';

import { startOptions } from './start';

const debug = debugFactory('nibus:start');
const stopCommand: CommandModule = {
  command: 'stop',
  describe: 'остановить службу NiBUS',
  builder: {},
  handler: () => {
    pm2.connect((err) => {
      if (err) {
        console.error('error while connect pm2', err.stack);
        pm2.disconnect();
        process.exit(2);
      }
      debug('pm2 is connected');
      pm2.delete(startOptions.name!, (error) => {
        if (error && error.message !== 'process name not found') {
          console.error('не удалось остановить сервис', error.message);
        } else {
          console.info('nibus.service остановлен');
        }
        pm2.disconnect();
      });
    });
  },
};

export default stopCommand;
