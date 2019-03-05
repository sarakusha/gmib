import { Arguments, CommandModule, Defined } from 'yargs';

import Address from '../../Address';
import { devices } from '../../mib';
import { NibusConnection } from '../../nibus';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

type WriteOpts = Defined<CommonOpts, 'mac' | 'm'>;

function write(
  // setCount: NibusCounter,
  argc: Arguments<WriteOpts>,
  address: Address,
  connection: NibusConnection,
  mib?: string): Promise<void>;
function write(
  // setCount: NibusCounter,
  argc: Arguments<WriteOpts>,
  address: Address,
  connection: NibusConnection,
  type: number): Promise<void>;
async function write(
  // setCount: NibusCounter,
  argc: Arguments<WriteOpts>,
  address: Address,
  connection: NibusConnection,
  mibOrType: any) {
  const device = devices.create(address, mibOrType);
  device.connection = connection;
  argc.quiet || console.log(`Writing to ${Reflect.getMetadata('mib', device)} [${address}]`);
  argc._
    .slice(1)
    .map(arg => arg.split('=', 2))
    .map(([name, value]) => [name && device.getName(name), value])
    .filter(([name, value]) => name && value !== '')
    .forEach(([name, value]) => {
      device[name] = value;
      argc.quiet || console.log(` - ${name} = ${JSON.stringify(device[name])}`);
      // setCount(c => c + 1);
    });
  return device.drain().then(() => {});
}

const writeCommand: CommandModule<CommonOpts, WriteOpts> = {
  command: 'write',
  describe: 'запись переменных в устройство',
  builder: argv => argv
    .demandOption(['mac', 'm'])
    .example('write', '$0 write -m ::ab:cd hofs=100 vofs=300 brightness=34'),
  handler: makeAddressHandler(write),
};

export default writeCommand;
