import { Arguments, CommandModule, Defined } from 'yargs';
import fs from 'fs';
import path from 'path';
import Progress from 'progress';
import { crc16ccitt } from 'crc';

import Address from '../../Address';
import { NMS_MAX_DATA_LENGTH } from '../../nbconst';
import { NibusConnection } from '../../nibus';
import { chunkArray } from '../../nibus/helper';
import {
  createNmsDownloadSegment,
  createNmsInitiateDownloadSequence,
  createNmsRequestDomainDownload, createNmsTerminateDownloadSequence, createNmsVerifyDomainChecksum,
  NmsDatagram,
} from '../../nms';
import { makeAddressHandler } from '../handlers';
import { CommonOpts } from '../options';

type DownloadOpts = Defined<CommonOpts, 'm' | 'mac'> & {
  domain: string,
  offset: number,
  source?: string,
  src?: string,
  hex?: boolean,
};

function readAllFromStdin(max: number) {
  const buffers: Buffer[] = [];
  let rest = max;
  const onData = (buffer: Buffer) => {
    if (rest <= 0) return;
    buffers.push(buffer);
    rest -= buffer.length;
  };
  return new Promise<Buffer>(((resolve, reject) => {
    process.stdin
      .on('data', onData)
      .once('end', () => {
        process.stdin.off('data', onData);
        process.stdin.off('error', reject);
        resolve(Buffer.concat(buffers).slice(0, max));
      })
      .once('error', reject);
  }));
}

async function download(
  { domain, offset, source, hex }: Arguments<DownloadOpts>,
  address: Address,
  connection: NibusConnection) {
  const reqDownload = createNmsRequestDomainDownload(address, domain.padEnd(8, ' '));
  const { id, value: max, status } = await connection.sendDatagram(reqDownload) as NmsDatagram;
  if (status !== 0) {
    // debug('<error>', status);
    throw new Error(`Request download domain error: ${status}`);
  }
  const initDownload = createNmsInitiateDownloadSequence(address, id);
  const { status: initStat } = await connection.sendDatagram(initDownload) as NmsDatagram;
  if (initStat !== 0) {
    throw new Error(`Initiate download domain error ${initStat}`);
  }
  let buffer: Buffer;
  let tick = (size: number) => {};
  if (source) {
    buffer = await fs.promises.readFile(source);
    if (buffer.length > max) {
      throw new Error(`File ${path.resolve(source)} to large. Expected ${max} bytes`);
    }
    const bar = new Progress(
      '  downloading [:bar] :rate/bps :percent :current/:total :etas',
      { total: buffer.length, width: 20 },
    );
    tick = bar.tick.bind(bar);
  } else {
    buffer = await readAllFromStdin(max);
  }
  const crc = crc16ccitt(buffer, 0);
  const chunkSize = NMS_MAX_DATA_LENGTH - 4;
  const chunks = chunkArray(buffer, chunkSize);
  await chunks.reduce(async (prev, chunk: Buffer, i) => {
    await prev;
    const segmentDownload = createNmsDownloadSegment(address, id, i * chunkSize + offset, chunk);
    const { status: downloadStat } = await connection.sendDatagram(segmentDownload) as NmsDatagram;
    if (downloadStat !== 0) {
      throw new Error(`Download segment error ${downloadStat}`);
    }
    tick(chunk.length);
  }, Promise.resolve());
  const verify = createNmsVerifyDomainChecksum(address, id, offset, buffer.length, crc);
  const { status: verifyStat } = await connection.sendDatagram(verify) as NmsDatagram;
  if (verifyStat !== 0) {
    throw new Error(`Download segment error ${verifyStat}`);
  }
  const terminate = createNmsTerminateDownloadSequence(address, id);
  const { status: termStat } = await connection.sendDatagram(terminate) as NmsDatagram;
  if (termStat !== 0) {
    throw new Error(`Terminate download sequence error ${termStat}`);
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
  handler: makeAddressHandler(download, true),
};

export default downloadCommand;
