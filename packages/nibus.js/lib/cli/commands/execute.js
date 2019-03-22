"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _handlers = require("../handlers");

async function action(device, args) {
  const vars = args._.slice(1).map(arg => arg.split('=', 2)).filter(([name, value]) => name !== '' && value !== '');

  const opts = vars.reduce((res, [name, value]) => {
    res[name] = value;
    return res;
  }, {});
  await device.execute(args.program, opts);
}

const executeCommand = {
  command: 'execute <program>',
  aliases: 'exec',
  describe: 'выполнить подпрограмму',
  builder: argv => argv.positional('program', {
    describe: 'название подпрограммы',
    type: 'string'
  }).example('$0 execute signal duration=30 source=1 -m 45:33', 'выполнить программу signal с' + ' параметрами duration и source').demandOption(['mac', 'm', 'program']),
  handler: (0, _handlers.makeAddressHandler)(action, true)
};
var _default = executeCommand;
exports.default = _default;