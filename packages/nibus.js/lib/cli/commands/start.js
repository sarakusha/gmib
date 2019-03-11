"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.startOptions = void 0;

var _pm = _interopRequireDefault(require("pm2"));

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  startOptions.script = 'service/dev.start.js';
  startOptions.watch = ['service/demon.ts', 'ipc/Server.ts', 'ipc/SerialTee.ts', 'service/detector.ts'];
}

const startCommand = {
  command: 'start',
  describe: 'запустить сервис NiBUS',
  builder: {},
  handler: () => {
    _pm.default.connect(err => {
      if (err) {
        console.error('error while connect pm2', err.stack);
        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(startOptions.name, () => _pm.default.start(startOptions, err => {
        _pm.default.disconnect();

        if (err) {
          console.error('error while start nibus.service', err);
          process.exit(2);
        }

        debug('nibus.service was started');
      }));
    });
  }
};
var _default = startCommand;
exports.default = _default;