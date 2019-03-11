"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _const = require("../../service/const");

var _ipc = require("../../ipc");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:log');
const logCommand = {
  command: 'log',
  describe: 'задать уровень логгирования',
  builder: argv => argv.option('level', {
    alias: ['l', 'lev'],
    desc: 'уровень',
    choices: ['none', 'hex', 'nibus'],
    default: 'none'
  }).option('pick', {
    desc: 'выдавать указанные поля в логах nibus',
    array: true
  }).option('omit', {
    desc: 'выдавть поля кроме указанных в логах nibus',
    array: true
  }),
  handler: ({
    level,
    pick,
    omit
  }) => new Promise((resolve, reject) => {
    const socket = _ipc.Client.connect(_const.PATH);

    let resolved = false;
    socket.once('close', () => {
      resolved ? resolve() : reject();
    });
    socket.on('error', err => {
      debug('<error>', err);
    });
    socket.on('connect', async () => {
      try {
        await socket.send('setLogLevel', level, pick, omit);
        resolved = true;
      } catch {}

      socket.destroy();
    });
  })
};
var _default = logCommand;
exports.default = _default;