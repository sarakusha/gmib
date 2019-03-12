import { CommandModule, Defined } from 'yargs';
import _ from 'lodash';
import session from '../../service';
import { CommonOpts } from '../options';

type PingOpts = Defined<CommonOpts, 'm' | 'mac'> & {
  c?: number,
  count?: number,
  t: number,
  timeout?: number,
};

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout * 1000));
const round = (val: number) => Math.round(val * 10) / 10;

const pingCommand: CommandModule<CommonOpts, PingOpts> = {
  command: 'ping',
  describe: 'пропинговать устройство',
  builder: argv => argv
    .option('c', {
      alias: 'count',
      describe: 'остановиться после отправки указанного количества ответов',
      number: true,
    })
    .option('t', {
      alias: 'timeout',
      describe: 'задать таймаут в секундах',
      default: 1,
      number: true,
    })
    .demandOption(['m', 'mac']),
  handler: async ({ count = -1, timeout = 1, mac }) => {
    await session.start();
    const stat: number[] = [];
    let transmitted = 0;
    process.on('exit', () => {
      const loss = 100 - round(stat.length / transmitted * 100);
      const min = _.min(stat);
      const max = _.max(stat);
      const avg = round(_.mean(stat));
      console.info(`
${transmitted} пакет(ов) отправлено, ${stat.length} пакет(ов) получено, ${loss}% пакетов потеряно
min/avg/max = ${min}/${avg}/${max}`);
    });
    while (count - transmitted !== 0) {
      const ping = await session.ping(mac);
      if (ping !== -1) stat.push(ping);
      transmitted += 1;
      console.info(`${mac} ${ping !== -1 ? `${ping} ms` : '*'}`);
      if (count - transmitted === 0) break;
      await delay(timeout);
    }
    session.close();
  },
};

export default pingCommand;
