"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pm = _interopRequireDefault(require("pm2"));

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:start'); // import { promisify } from 'util';
// const connect = promisify(pm2.connect);
// const start = promisify<StartOptions>(pm2.start);

const startOptions = {
  name: 'nibus.service',
  script: 'service/start.js',
  cwd: _path.default.resolve(__dirname, '..'),
  max_restarts: 3
};

if (process.env.NODE_ENV === 'development') {
  startOptions.script = 'service/dev.start.js';
  startOptions.watch = ['service/start.ts', 'ipc/Server.ts', 'ipc/SerialTee.ts', 'service/detection.ts'];
}

const service = {
  command: 'service',
  describe: 'start nibus as a service',
  builder: {},
  handler: () => {
    _pm.default.connect(err => {
      if (err) {
        console.error('error while connect pm2', err.stack);
        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(String(startOptions.name), () => _pm.default.start(startOptions, err => {
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
var _default = service;
exports.default = _default;