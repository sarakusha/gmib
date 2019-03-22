"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _PathReporter = require("io-ts/lib/PathReporter");

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
  handler: async ({
    mibfile
  }) => {
    const dest = _path.default.resolve(__dirname, '../../../mibs');

    await (0, _mib.convert)(mibfile, dest);

    const validation = _mib.MibDeviceV.decode(require(dest));

    if (validation.isLeft()) {
      throw new Error(`Invalid mib file: ${mibfile}
      ${_PathReporter.PathReporter.report(validation)}`);
    }
  }
};
var _default = mibCommand;
exports.default = _default;