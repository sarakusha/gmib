"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pm = _interopRequireDefault(require("pm2"));

var _debug = _interopRequireDefault(require("debug"));

var _start = require("./start");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:start');
const stopCommand = {
  command: 'stop',
  describe: 'остановить службу NiBUS',
  builder: {},
  handler: () => {
    _pm.default.connect(err => {
      if (err) {
        console.error('error while connect pm2', err.stack);

        _pm.default.disconnect();

        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(_start.startOptions.name, error => {
        if (error) {
          error.message === 'process name not found' || console.error('error while delete', error.message);
        } else {
          debug('nibus.service stopped');
        }

        _pm.default.disconnect();
      });
    });
  }
};
var _default = stopCommand;
exports.default = _default;