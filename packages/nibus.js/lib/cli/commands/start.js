"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.startOptions = void 0;

var _pm = _interopRequireDefault(require("pm2"));

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import { promisify } from 'util';
const debug = (0, _debug.default)('nibus:start'); // import { promisify } from 'util';
// const connect = promisify(pm2.connect);
// const start = promisify<StartOptions>(pm2.start);

const startOptions = {
  name: 'nibus.service',
  script: 'service/demon.js',
  cwd: _path.default.resolve(__dirname, '../..'),
  max_restarts: 3
};
exports.startOptions = startOptions;

if (_path.default.extname(__filename) === '.ts') {
  startOptions.env = {
    DEBUG: 'nibus:*,-nibus:decoder',
    DEBUG_COLORS: '1'
  };
  startOptions.script = 'service/dev.start.js';
  startOptions.watch = ['service/demon.ts', 'ipc/Server.ts', 'ipc/SerialTee.ts', 'service/detector.ts'];
}

const startup = platform => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

  _pm.default.startup(platform, err => {
    clearTimeout(timeout);
    if (err) return reject(err);
    resolve();
  });
});

const startCommand = {
  command: 'start',
  describe: 'запустить сервис NiBUS',
  builder: argv => argv.option('auto', {
    describe: 'автозапуск сервиса после старта стистемы для заданной ОС',
    choices: ['ubuntu', 'centos', 'redhat', 'gentoo', 'systemd', 'darwin', 'amazon']
  }),
  handler: argc => {
    _pm.default.connect(err => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(startOptions.name, () => _pm.default.start(startOptions, async err => {
        if (!err && argc.auto) {
          try {
            await startup(argc.auto);
          } catch (e) {
            console.error('Не удалось зарегестрировать сервис', e.message);
          }
        }

        _pm.default.disconnect();

        if (err) {
          console.error('error while start nibus.service', err);
          process.exit(2);
        }

        console.info('nibus.service запущен');
      }));
    });
  }
};
var _default = startCommand;
exports.default = _default;