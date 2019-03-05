import { CommandModule } from 'yargs';
import session from '../../service';

const pingCommand: CommandModule = {
  command: 'ping',
  describe: 'пропинговать устройство',
  builder: argv => argv.demandOption(['m', 'mac']),
  handler: async (argv) => {
    await session.start();
    const timeout = await session.ping(argv.mac as string);
    console.info(timeout);
    session.close();
  },
};

export default pingCommand;
