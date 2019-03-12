"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _mib = require("../../mib");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const mibCommand = {
  command: 'mib <mibfile>',
  describe: 'добавить mib-файл',
  builder: argv => argv.positional('mibfile', {
    describe: 'путь к mib-файлу',
    type: 'string'
  }).demandOption('mibfile'),
  handler: ({
    mibfile
  }) => {
    return (0, _mib.convert)(mibfile, _path.default.resolve(__dirname, '../../../mibs'));
  }
};
var _default = mibCommand;
exports.default = _default;