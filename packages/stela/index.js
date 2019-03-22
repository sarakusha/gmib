#!/usr/bin/env node --no-warnings
const pm2 = require('pm2');
const startOptions = {
  name: 'stela',
  script: 'lib/server/index.js',
  cwd: __dirname,
};

pm2.connect((err) => {
  if (err) {
    console.error('не удалось подключиться к pm2', err.message);
    process.exit(2);
  }
  pm2.delete(startOptions.name, () => {
    pm2.start(startOptions, (err) => {
      if (err) {
        console.error('не удалось запустить', err.message);
        process.exit(2);
      }
      pm2.startup('ubuntu', (err) => {
        if (err) {
          console.error('не удалось зарегистрировать', err.message);
          process.exit(2);
        }
        console.log('запущен');
      });
    });
  });
});
