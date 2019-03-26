#!/usr/bin/env node
const pm2 = require('pm2');
const path = require('path');
const commander = require('commander');
const pkg = require('./package');
const startOptions = {
  name: 'stela',
  script: 'lib/server/index.js',
  cwd: __dirname,
  env: {
    NODE_ENV: 'production',
  },
};

commander
  .version(pkg.version)
  .option('-u <user>', 'Имя пользователя')
  .option('--hp <home>', 'Домашняя директория');

commander
  .command('start')
  .description('Запустить stela')
  .option('-p, --port <port>', 'Номер порта', parseInt, 3000)
  .action(({ port }) => {
    startOptions.env['PORT'] = port;
    console.log(path.resolve(__dirname, 'lib/server/index.js'));
    pm2.connect((err) => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }
      pm2.delete(startOptions.name, () => {
        pm2.start(startOptions, (err) => {
          pm2.disconnect();
          if (err) {
            console.error('Запуск не удался:', err.message);
            process.exit(2);
          }
          console.error('Сервис запущен.');
        });
      });
    });
  });

commander
  .command('stop')
  .description('Остановить stela')
  .action(() => {
    pm2.connect((err) => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }
      pm2.delete(startOptions.name, (err) => {
        pm2.disconnect();
        if (err) {
          console.error('Ошибка:', err.message);
          process.exit(2);
        }
        console.error('Сервис остановлен.');
      });
    });
  });

commander
  .command('startup [platform]')
  .description('Поставить в автозапуск')
  .action((platform) => {
    const os = require('os');
    if (os.platform() === 'win32') {
      console.error(`Startup not supported for windows.
      There are some external libraries to generate a Windows compatible startup script, please checkout pm2-windows-service or pm2-windows-startup.`);
      process.exit(2);
    }
    pm2.connect((err) => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }
      if (process.geteuid() !== 0) {
        console.log('To setup the Startup Script, copy/paste the following command');
      }
      pm2.startup(platform, commander, (err) => {
        pm2.disconnect();
        if (err) {
          console.error(err.message);
          process.exit(2);
        }
      });
    });
  });

commander
  .command('unstartup [platform]')
  .description('Убрать из автозапуска')
  .action((platform) => {
    pm2.connect((err) => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }
      if (process.geteuid() !== 0) {
        console.log('To setup the Startup Script, copy/paste the following command');
      }
      pm2.uninstallStartup(platform, commander, (err) => {
        pm2.disconnect();
        if (err) {
          console.error(err.message);
          process.exit(2);
        }
      });
    });
  });

commander
  .parse(process.argv);

if (process.argv.length < 3) {
  commander.help();
}
!commander.commands.map(cmd => cmd._name).includes(commander.args[0]._name) && commander.help();
