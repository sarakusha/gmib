"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.action = action;
exports.default = void 0;

var _handlers = require("../handlers");

async function action(device, args) {
  const vars = args._.slice(1).map(arg => arg.split('=', 2)).filter(([name, value]) => name !== '' && value !== '').map(([name, value]) => [device.getName(name), device.getId(name), value]);

  vars.forEach(([name,, value]) => {
    device[name] = value;
  });

  if (vars.length === 0) {
    return;
  }

  args.quiet || console.log(`Writing to ${Reflect.getMetadata('mib', device)} [${device.address}]`);
  return device.write(...vars.map(([, id]) => id)).then(ids => {
    if (args.quiet) return;
    ids.map(id => device.getName(id)).forEach(name => console.log(` - ${name} = ${JSON.stringify(device[name])}`));
  });
}

const writeCommand = {
  command: 'write',
  describe: 'запись переменных в устройство',
  builder: argv => argv.demandOption(['mac', 'm']).example('$0 write -m ::ab:cd hofs=100 vofs=300 brightness=34', `записать в переменные: hofs<-100, vofs<-300, brightness<-34 на устройстве с адресом ::ab:cd
      mib указывать не обязательно, если у устройства есть firmware_version`),
  handler: (0, _handlers.makeAddressHandler)(action, true)
};
var _default = writeCommand;
exports.default = _default;