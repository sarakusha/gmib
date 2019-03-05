import { Arguments, CommandModule, Defined } from 'yargs';
import fs from 'fs';
import path from 'path';
import util from 'util';
import Progress from 'progress';
// import debugFactory from 'debug';

import Address from '../../Address';
import { NibusConnection } from '../../nibus';
import { printBuffer } from '../../nibus/helper';
import {
  createNmsInitiateUploadSequence,
  createNmsRequestDomainUpload, createNmsUploadSegment,
  NmsDatagram,
} from '../../nms';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

// const debug = debugFactory('nibus:upload');

type UploadOpts = Defined<CommonOpts, 'mac' | 'm'> & {
  domain: string,
  offset: number,
  size?: number,
  o?: string,
  out?: string,
  hex?: boolean,
  f?: boolean,
  force?: boolean,
};

async function upload(
  // setCount: NibusCounter,
  { domain, offset, size, out, force, hex, raw }: Arguments<UploadOpts>,
  address: Address,
  connection: NibusConnection) {
  const reqUpload = createNmsRequestDomainUpload(address, domain.padEnd(8, ' '));
  const { id, value: domainSize, status } = await connection.sendDatagram(reqUpload) as NmsDatagram;
  // let ws: NodeJS.WriteStream | WriteStream;
  let close = () => {};
  let write: (data: any) => Promise<void>;
  let tick = (size: number) => {};
  if (status !== 0) {
    // debug('<error>', status);
    throw new Error(`Request upload domain error: ${status}`);
  }
  const initUpload = createNmsInitiateUploadSequence(address, id);
  const { status: initStat } = await connection.sendDatagram(initUpload) as NmsDatagram;
  if (initStat !== 0) {
    throw new Error(`Initiate upload domain error ${initStat}`);
  }
  let rest = size || domainSize;
  let pos = offset;
  if (out) {
    if (!force && fs.existsSync(out)) {
      throw new Error(`File ${path.resolve(out)} already exists`);
    }
    const ws = fs.createWriteStream(out, {
      encoding: hex ? 'utf8' : 'binary',
    });
    write = util.promisify(ws.write.bind(ws));
    close = ws.close.bind(ws);
    const bar = new Progress(
      `  uploading [:bar] ${rest <= 50 ? '' : ':rate/bps :percent '}:current/:total :etas`,
      {
        total: rest,
        width: 20,
      },
    );
    tick = bar.tick.bind(bar);
  } else {
    write = util.promisify(process.stdout.write.bind(process.stdout));
  }
  if (hex) {
    await write(`DOMAIN: ${domain}
OFFSET: ${offset}
SIZE: ${rest}
`);
  }
  while (rest > 0) {
    const length = Math.min(255, rest);
    const uploadSegment = createNmsUploadSegment(address, id, pos, length);
    // setCount(c => c + 1);
    const segment = await connection.sendDatagram(uploadSegment) as NmsDatagram;
    const { status: uploadStatus, value: result } = segment;
    if (uploadStatus !== 0) {
      throw new Error(`Upload segment error ${uploadStatus}`);
    }
    if (hex) {
      await write(printBuffer(result.data));
      await write('\n');
    } else {
      await write(result.data);
    }
    // console.log(printBuffer(result.data));
    // data.push(result.data);
    rest -= result.data.length;
    pos += result.data.length;
    tick(result.data.length);
  }
  // console.log(printBuffer(Buffer.concat(data)));
  close();
}

const uploadCommand: CommandModule<CommonOpts, UploadOpts> = {
  command: 'upload',
  describe: 'выгрузить домен из устройства',
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
      .option('size', {
        alias: 'length',
        number: true,
        describe: 'требуемое количество байт',
      })
      .option('out', {
        alias: 'o',
        string: true,
        describe: 'сохранить в файл',
      })
      .option('hex', {
        boolean: true,
        describe: 'использовать текстовый формат',
      })
      .option('f', {
        alias: 'force',
        boolean: true,
        describe: 'перезаписать существующий файл',
      })
      .demandOption(['m', 'mac', 'domain']),
  handler: makeAddressHandler(upload, true),
};

export default uploadCommand;
