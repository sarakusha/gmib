"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _progress = _interopRequireDefault(require("progress"));

var _crc = require("crc");

var _nbconst = require("../../nbconst");

var _helper = require("../../nibus/helper");

var _nms = require("../../nms");

var _handlers = require("../handlers");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function readAllFromStdin(max) {
  const buffers = [];
  let rest = max;

  const onData = buffer => {
    if (rest <= 0) return;
    buffers.push(buffer);
    rest -= buffer.length;
  };

  return new Promise((resolve, reject) => {
    process.stdin.on('data', onData).once('end', () => {
      process.stdin.off('data', onData);
      process.stdin.off('error', reject);
      resolve(Buffer.concat(buffers).slice(0, max));
    }).once('error', reject);
  });
}

async function download({
  domain,
  offset,
  source,
  hex
}, address, connection) {
  const reqDownload = (0, _nms.createNmsRequestDomainDownload)(address, domain.padEnd(8, ' '));
  const {
    id,
    value: max,
    status
  } = await connection.sendDatagram(reqDownload);

  if (status !== 0) {
    // debug('<error>', status);
    throw new Error(`Request download domain error: ${status}`);
  }

  const initDownload = (0, _nms.createNmsInitiateDownloadSequence)(address, id);
  const {
    status: initStat
  } = await connection.sendDatagram(initDownload);

  if (initStat !== 0) {
    throw new Error(`Initiate download domain error ${initStat}`);
  }

  let buffer;

  let tick = size => {};

  if (source) {
    buffer = await _fs.default.promises.readFile(source);

    if (buffer.length > max) {
      throw new Error(`File ${_path.default.resolve(source)} to large. Expected ${max} bytes`);
    }

    const bar = new _progress.default('  downloading [:bar] :rate/bps :percent :current/:total :etas', {
      total: buffer.length,
      width: 20
    });
    tick = bar.tick.bind(bar);
  } else {
    buffer = await readAllFromStdin(max);
  }

  const crc = (0, _crc.crc16ccitt)(buffer, 0);
  const chunkSize = _nbconst.NMS_MAX_DATA_LENGTH - 4;
  const chunks = (0, _helper.chunkArray)(buffer, chunkSize);
  await chunks.reduce(async (prev, chunk, i) => {
    await prev;
    const segmentDownload = (0, _nms.createNmsDownloadSegment)(address, id, i * chunkSize + offset, chunk);
    const {
      status: downloadStat
    } = await connection.sendDatagram(segmentDownload);

    if (downloadStat !== 0) {
      throw new Error(`Download segment error ${downloadStat}`);
    }

    tick(chunk.length);
  }, Promise.resolve());
  const verify = (0, _nms.createNmsVerifyDomainChecksum)(address, id, offset, buffer.length, crc);
  const {
    status: verifyStat
  } = await connection.sendDatagram(verify);

  if (verifyStat !== 0) {
    throw new Error(`Download segment error ${verifyStat}`);
  }

  const terminate = (0, _nms.createNmsTerminateDownloadSequence)(address, id);
  const {
    status: termStat
  } = await connection.sendDatagram(terminate);

  if (termStat !== 0) {
    throw new Error(`Terminate download sequence error ${termStat}`);
  }
}

const downloadCommand = {
  command: 'download',
  describe: 'загрузить домен в устройство',
  builder: argv => argv.option('domain', {
    default: 'CODE',
    describe: 'имя домена',
    string: true
  }).option('offset', {
    alias: 'ofs',
    default: 0,
    number: true,
    describe: 'смещение в домене'
  }).option('source', {
    alias: 'src',
    string: true,
    describe: 'загрузить данные из файла'
  }).option('hex', {
    boolean: true,
    describe: 'использовать текстовый формат'
  }).check(({
    hex,
    raw
  }) => {
    if (hex && raw) throw new Error('Arguments hex and raw are mutually exclusive');
    return true;
  }).demandOption(['m', 'mac']),
  handler: (0, _handlers.makeAddressHandler)(download, true)
};
var _default = downloadCommand;
exports.default = _default;