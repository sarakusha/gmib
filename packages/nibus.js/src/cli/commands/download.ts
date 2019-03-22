import { Arguments, CommandModule, Defined } from 'yargs';
import fs from 'fs';
import Progress from 'progress';

import { IDevice } from '../../mib';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';
import { action as writeAction } from './write';

type DownloadOpts = Defined<CommonOpts, 'm' | 'mac'> & {
  domain: string,
  offset: number,
  source?: string,
  src?: string,
  hex?: boolean,
};

function readAllFromStdin() {
  const buffers: Buffer[] = [];
  // let rest = max;
  const onData = (buffer: Buffer) => {
    // if (rest <= 0) return;
    buffers.push(buffer);
    // rest -= buffer.length;
  };
  return new Promise<Buffer>(((resolve, reject) => {
    process.stdin
      .on('data', onData)
      .once('end', () => {
        process.stdin.off('data', onData);
        process.stdin.off('error', reject);
        resolve(Buffer.concat(buffers));
      })
      .once('error', reject);
  }));
}

export const convert = (buffer: Buffer): [Buffer, number] => {
  const lines = buffer.toString('ascii').split(/\r?\n/g);
  let offset = 0;
  if (lines.length === 0) return [Buffer.alloc(0), 0];
  const first = lines[0];
  let start = 0;
  if (first[0] === '@') {
    offset = parseInt(first.slice(1), 16);
    start = 1;
  }
  const hexToBuf = (hex: string) => Buffer.from(hex.split(/[\s:-=]/g).join(''), 'hex');
  return [Buffer.concat(lines.slice(start).map(hexToBuf)), offset];
};

export async function action(
  device: IDevice,
  args: Arguments<DownloadOpts>) {
  const { domain, offset, source, hex } = args;
  await writeAction(device, args);
  let buffer: Buffer;
  let ofs = 0;
  let tick = (size: number) => {};
  if (source) {
    buffer = await fs.promises.readFile(source);
    if (hex) [buffer, ofs] = convert(buffer);
    const dest = (offset || ofs).toString(16).padStart(4, '0');
    const bar = new Progress(
      `  downloading [:bar] to ${dest} :rate/bps :percent :current/:total :etas`,
      {
        total: buffer.length,
        width: 20,
      },
    );
    tick = bar.tick.bind(bar);
  } else {
    buffer = await readAllFromStdin();
    if (hex) {
      [buffer, ofs] = convert(buffer);
    }
  }
  device.on('downloadData', ({ domain: dataDomain, length }) => {
    if (dataDomain === domain) tick(length);
  });

  await device.download(domain, buffer, offset || ofs);
}

const downloadCommand: CommandModule<CommonOpts, DownloadOpts> = {
  command: 'download',
  describe: 'загрузить домен в устройство',
  builder: argv =>
    argv
      .option('domain', {
        default: 'CODE',
        describe: 'имя домена',
        string: true,
      })
      .option('offset', {
        alias: 'ofs',
        default: 0,
        number: true,
        describe: 'смещение в домене',
      })
      .option('source', {
        alias: 'src',
        string: true,
        describe: 'загрузить данные из файла',
      })
      .option('hex', {
        boolean: true,
        describe: 'использовать текстовый формат',
      })
      .check(({ hex, raw }) => {
        if (hex && raw) throw new Error('Arguments hex and raw are mutually exclusive');
        return true;
      })
      .demandOption(['m', 'mac']),
  handler: makeAddressHandler(action, true),
};

export default downloadCommand;
