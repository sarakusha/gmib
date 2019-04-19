/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import pm2, { StartOptions } from 'pm2';
import { CommandModule } from 'yargs';
import path from 'path';
import debugFactory from 'debug';
// import { promisify } from 'util';

const debug = debugFactory('nibus:start');
// import { promisify } from 'util';

// const connect = promisify(pm2.connect);
// const start = promisify<StartOptions>(pm2.start);

export const startOptions: StartOptions = {
  name: 'nibus.service',
  script: 'service/daemon.js',
  cwd: path.resolve(__dirname, '../..'),
  max_restarts: 3,
  env: {
    DEBUG: 'nibus:*,-nibus:decoder',
    DEBUG_COLORS: '1',
  },
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

const startup = (platform: any) => new Promise(((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
  pm2.startup(platform, (err) => {
    clearTimeout(timeout);
    if (err) return reject(err);
    resolve();
  });
}));

const startCommand: CommandModule = {
  command: 'start',
  describe: 'запустить сервис NiBUS',
  builder: argv => argv
    .option('auto', {
      describe: 'автозапуск сервиса после старта стистемы для заданной ОС',
      choices: ['ubuntu', 'centos', 'redhat', 'gentoo', 'systemd', 'darwin', 'amazon'],
    }),
  handler: (argc) => {
    pm2.connect((err) => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }
      debug('pm2 is connected');
      pm2.delete(startOptions.name!, () =>
        pm2.start(startOptions, async (err) => {
          if (!err && argc.auto) {
            try {
              await startup(argc.auto as any);
            } catch (e) {
              console.error('Не удалось зарегестрировать сервис', e.message);
            }
          }
          pm2.disconnect();
          if (err) {
            console.error('error while start nibus.service', err);
            process.exit(2);
          }
          console.info('nibus.service запущен');
        }));
    });
  },
};

export default startCommand;
