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
  handler: async ({ count = -1, timeout = 1, mac, quiet, raw }) => {
    await session.start();
    const stat: number[] = [];
    let transmitted = 0;
    process.on('exit', () => {
      const loss = 100 - round(stat.length / transmitted * 100);
      const min = _.min(stat);
      const max = _.max(stat);
      const avg = round(_.mean(stat));
      quiet || raw || console.info(`
${transmitted} пакет(ов) отправлено, ${stat.length} пакет(ов) получено, ${loss}% пакетов потеряно
min/avg/max = ${min || '-'}/${Number.isNaN(avg) ? '-' : avg}/${max || '-'}`);
    });
    let exit = false;
    process.on('SIGINT', () => {
      exit = true;
    });
    while (count - transmitted !== 0 && !exit) {
      const ping = await session.ping(mac);
      if (ping !== -1) stat.push(ping);
      transmitted += 1;
      quiet || raw || console.info(`${mac} ${ping !== -1 ? `${ping} ms` : '*'}`);
      if (count - transmitted === 0) break;
      await delay(timeout);
    }
    session.close();
    if (raw) console.info(stat.length);
    if (stat.length === 0) return Promise.reject();
  },
};

export default pingCommand;
