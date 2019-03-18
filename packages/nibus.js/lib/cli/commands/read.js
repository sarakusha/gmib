"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.action = action;
exports.default = void 0;

var _handlers = require("../handlers");

async function action(device, args) {
  const idOrName = args.id[0];

  if (idOrName) {
    const id = device.getId(idOrName);
    const value = Object.values((await device.read(id)))[0];
    if (value.error) throw new Error(value.error);
    args.quiet || console.log(JSON.stringify(args.raw ? device.getRawValue(id) : value));
  }
}

const readCommand = {
  command: 'read',
  describe: 'прочитать значение переменной',
  builder: argv => argv.demandOption(['id', 'name', 'mac', 'm']).check(argv => {
    if (Array.isArray(argv.id) && argv.id.length !== 1) {
      throw 'Только одна переменная id за раз';
    }

    return true;
  }),
  handler: (0, _handlers.makeAddressHandler)(action, true)
};
var _default = readCommand;
exports.default = _default;