import { Arguments, CommandModule, Defined } from 'yargs';

import Address from '../../Address';
import { devices } from '../../mib';
import { NibusConnection } from '../../nibus';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

type ReadOpts = Defined<CommonOpts, 'id' | 'name' | 'm' | 'mac'>;

function read(
  // setCount: NibusCounter,
  args: Arguments<ReadOpts>,
  address: Address,
  connection: NibusConnection,
  mib?: string): Promise<void>;
function read(
  // setCount: NibusCounter,
  args: Arguments<ReadOpts>,
  address: Address,
  connection: NibusConnection,
  type: number): Promise<void>;
async function read(
  // setCount: NibusCounter,
  args: Arguments<ReadOpts>,
  address: Address,
  connection: NibusConnection,
  mibOrType: any): Promise<void> {
  const device = devices.create(address, mibOrType);
  device.connection = connection;
  const idOrName = args.id[0];
  if (idOrName) {
    const id = device.getId(idOrName);
    const value = Object.values(await device.read(id))[0];
    if (value.error) throw new Error(value.error);
    console.log(JSON.stringify(args.raw ? device.getRawValue(id) : value));
  }
}

const readCommand: CommandModule<CommonOpts, ReadOpts> = {
  command: 'read',
  describe: 'прочитать значение переменной',
  builder: argv => argv
    .demandOption(['id', 'name', 'mac', 'm'])
    .check((argv) => {
      if (Array.isArray(argv.id) && argv.id.length !== 1) {
        throw 'Только одна переменная id за раз';
      }
      return true;
    }),
  handler: makeAddressHandler(read, true),
};

export default readCommand;
