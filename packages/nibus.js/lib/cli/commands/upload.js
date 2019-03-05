"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _util = _interopRequireDefault(require("util"));

var _progress = _interopRequireDefault(require("progress"));

var _helper = require("../../nibus/helper");

var _nms = require("../../nms");

var _handlers = require("../handlers");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function upload( // setCount: NibusCounter,
{
  domain,
  offset,
  size,
  out,
  force,
  hex,
  raw
}, address, connection) {
  const reqUpload = (0, _nms.createNmsRequestDomainUpload)(address, domain.padEnd(8, ' '));
  const {
    id,
    value: domainSize,
    status
  } = await connection.sendDatagram(reqUpload); // let ws: NodeJS.WriteStream | WriteStream;

  let close = () => {};

  let write;

  let tick = size => {};

  if (status !== 0) {
    // debug('<error>', status);
    throw new Error(`Request upload domain error: ${status}`);
  }

  const initUpload = (0, _nms.createNmsInitiateUploadSequence)(address, id);
  const {
    status: initStat
  } = await connection.sendDatagram(initUpload);

  if (initStat !== 0) {
    throw new Error(`Initiate upload domain error ${initStat}`);
  }

  let rest = size || domainSize;
  let pos = offset;

  if (out) {
    if (!force && _fs.default.existsSync(out)) {
      throw new Error(`File ${_path.default.resolve(out)} already exists`);
    }

    const ws = _fs.default.createWriteStream(out, {
      encoding: hex ? 'utf8' : 'binary'
    });

    write = _util.default.promisify(ws.write.bind(ws));
    close = ws.close.bind(ws);
    const bar = new _progress.default(`  uploading [:bar] ${rest <= 50 ? '' : ':rate/bps :percent '}:current/:total :etas`, {
      total: rest,
      width: 20
    });
    tick = bar.tick.bind(bar);
  } else {
    write = _util.default.promisify(process.stdout.write.bind(process.stdout));
  }

  if (hex) {
    await write(`DOMAIN: ${domain}
OFFSET: ${offset}
SIZE: ${rest}
`);
  }

  while (rest > 0) {
    const length = Math.min(255, rest);
    const uploadSegment = (0, _nms.createNmsUploadSegment)(address, id, pos, length); // setCount(c => c + 1);

    const segment = await connection.sendDatagram(uploadSegment);
    const {
      status: uploadStatus,
      value: result
    } = segment;

    if (uploadStatus !== 0) {
      throw new Error(`Upload segment error ${uploadStatus}`);
    }

    if (hex) {
      await write((0, _helper.printBuffer)(result.data));
      await write('\n');
    } else {
      await write(result.data);
    } // console.log(printBuffer(result.data));
    // data.push(result.data);


    rest -= result.data.length;
    pos += result.data.length;
    tick(result.data.length);
  } // console.log(printBuffer(Buffer.concat(data)));


  close();
}

const uploadCommand = {
  command: 'upload',
  describe: 'выгрузить домен из устройства',
  builder: argv => argv.option('domain', {
    default: 'CODE',
    describe: 'имя домена',
    string: true
  }).option('offset', {
    alias: 'ofs',
    default: 0,
    number: true,
    describe: 'смещение в домене'
  }).option('size', {
    alias: 'length',
    number: true,
    describe: 'требуемое количество байт'
  }).option('out', {
    alias: 'o',
    string: true,
    describe: 'сохранить в файл'
  }).option('hex', {
    boolean: true,
    describe: 'использовать текстовый формат'
  }).option('f', {
    alias: 'force',
    boolean: true,
    describe: 'перезаписать существующий файл'
  }).demandOption(['m', 'mac', 'domain']),
  handler: (0, _handlers.makeAddressHandler)(upload, true)
};
var _default = uploadCommand;
exports.default = _default;