import { Arguments, CommandModule, Defined } from 'yargs';
import fs from 'fs';
import Progress from 'progress';

import { IDevice } from '../../mib';
import { DownloadDataListener } from '../../mib/devices';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

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

// TODO hex
async function action(device: IDevice, { domain, offset, source, hex }: Arguments<DownloadOpts>) {
  let buffer: Buffer;
  let tick = (size: number) => {};
  if (source) {
    buffer = await fs.promises.readFile(source);
    const bar = new Progress(
      '  downloading [:bar] :rate/bps :percent :current/:total :etas',
      {
        total: buffer.length,
        width: 20,
      },
    );
    tick = bar.tick.bind(bar);
  } else {
    buffer = await readAllFromStdin();
  }
  const onData: DownloadDataListener = ({ domain: dataDomain, length }) => {
    if (dataDomain === domain) tick(length);
  };
  device.on('downloadData', onData);

  try {
    await device.download(domain, buffer, offset);
  } finally {
    device.off('downloadData', onData);
  }
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
