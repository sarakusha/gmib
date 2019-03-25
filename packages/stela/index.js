#!/usr/bin/env node
const pm2 = require('pm2');
const path = require('path');
const startOptions = {
  name: 'stela',
  script: 'lib/server/index.js',
  cwd: __dirname,
  env: {
    NODE_ENV: 'production',
  },
};

console.log(path.resolve(__dirname, 'lib/server/index.js'));
// process.argv.forEach((val, index) => {
//   console.log(`${index}: ${val}`);
// });

// process.exit(0);

if (process.argv[2] === 'startup') {
  pm2.connect((err) => {
    if (err) {
      console.error('не удалось подключиться к pm2', err.message);
      process.exit(2);
    }
    const platform = process.argv[3] || 'ubuntu';
    pm2.startup(platform, (err) => {
      if (err) {
        console.error('не удалось зарегистрировать', err.message);
        process.exit(2);
      }
      console.log('запущен');
      pm2.disconnect();
    });
  });
} else {
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
        console.error('запущен');
        pm2.disconnect();
      });
    });
  });
}
