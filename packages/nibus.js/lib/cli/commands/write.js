"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _mib = require("../../mib");

var _handlers = require("../handlers");

async function write( // setCount: NibusCounter,
argc, address, connection, mibOrType) {
  const device = _mib.devices.create(address, mibOrType);

  device.connection = connection;
  argc.quiet || console.log(`Writing to ${Reflect.getMetadata('mib', device)} [${address}]`);

  argc._.slice(1).map(arg => arg.split('=', 2)).map(([name, value]) => [name && device.getName(name), value]).filter(([name, value]) => name && value !== '').forEach(([name, value]) => {
    device[name] = value;
    argc.quiet || console.log(` - ${name} = ${JSON.stringify(device[name])}`); // setCount(c => c + 1);
  });

  return device.drain().then(() => {});
}

const writeCommand = {
  command: 'write',
  describe: 'запись переменных в устройство',
  builder: argv => argv.demandOption(['mac', 'm']).example('write', '$0 write -m ::ab:cd hofs=100 vofs=300 brightness=34'),
  handler: (0, _handlers.makeAddressHandler)(write)
};
var _default = writeCommand;
exports.default = _default;