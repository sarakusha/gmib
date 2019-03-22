"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _crc = require("crc");

var _fs = _interopRequireDefault(require("fs"));

var _lodash = _interopRequireDefault(require("lodash"));

var _progress = _interopRequireDefault(require("progress"));

var _nibus = require("../../nibus");

var _handlers = require("../handlers");

var _write = require("./write");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const domain = 'RFLASH';
const crcPrev = 0xAA55;

const ident = buf => buf;

const createHeader = (kind, option, data) => {
  const buffer = Buffer.alloc(20);
  buffer.write(kind.padEnd(4, '\0'));
  buffer.writeUInt32LE(data.length, 4);
  buffer.writeUInt32LE(Math.round(Date.now() / 1000), 8);
  buffer.writeUInt16LE(option, 16);
  buffer.writeUInt16LE((0, _crc.crc16ccitt)(buffer.slice(0, 18), crcPrev), 18);
  return buffer;
};

const hexToBuf = hex => Buffer.from(hex.split(/[\s:-=]/g).join(''), 'hex');

const txtConvert = buffer => {
  const lines = buffer.toString('ascii').split(/\r?\n/g);
  const result = Buffer.alloc(32768, 0xFF);
  const begin = 0x8000;
  let offset = 0;
  lines.forEach(line => {
    if (line[0] === '@') {
      offset = parseInt(line.slice(1), 16) - begin;
    } else {
      offset += hexToBuf(line).copy(result, offset);
    }
  });
  return result;
};

const decConvert = data => {
  const lines = data.toString().split(/\r?\n/g);

  const raw = _lodash.default.flatten(lines.map(line => line.trim()).filter(line => !!line).map(line => line.split(/\s+/g).map(b => {
    const i = parseInt(b, 10);
    if (Number.isNaN(i)) console.error('Invalid Number', b);
    return i;
  })));

  if (_lodash.default.some(raw, b => Number.isNaN(b))) throw new Error('Invalid number');
  return Buffer.from(_lodash.default.flatten(raw.map(word => [word & 0xFF, word >> 8 & 0xFF])));
};

const meta = {
  rbf: {
    offset: 0x60000,
    size: [368011],
    converter: ident
  },
  tca: {
    offset: 0xC0000,
    size: [1536, 2822],
    converter: decConvert
  },
  tcc: {
    offset: 0xC0000,
    size: [1536, 2822],
    converter: decConvert
  },
  ctrl: {
    offset: 0xF0000,
    size: [32768],
    converter: txtConvert
  }
};

async function action(device, args) {
  (0, _nibus.setNibusTimeout)(5000);

  try {
    await (0, _write.action)(device, args);
    const opts = meta[args.kind];
    let buffer = opts.converter((await _fs.default.promises.readFile(args.source)));

    if (!opts.size.includes(buffer.length)) {
      throw new Error(`Invalid data length. Expected ${opts.size.join(',')} got ${buffer.length}`);
    }

    if (args.kind !== 'ctrl') {
      const header = createHeader(args.kind, 0, buffer);
      buffer = Buffer.concat([header, buffer, header]);
    } else {
      const crc = Buffer.alloc(2);
      crc.writeUInt16LE((0, _crc.crc16ccitt)(buffer, crcPrev), 0);
      buffer = Buffer.concat([buffer, crc]);
    }

    const dest = opts.offset.toString(16).padStart(4, '0');
    const bar = new _progress.default(`  flashing [:bar] to ${dest} :rate/bps :percent :current/:total :etas`, {
      total: buffer.length,
      width: 30
    });
    device.on('downloadData', ({
      domain: downloadDomain,
      length
    }) => {
      if (domain === downloadDomain) bar.tick(length);
    });
    await device.download(domain, buffer, opts.offset);

    if (args.execute) {
      await device.execute(args.execute);
    }
  } finally {
    (0, _nibus.setNibusTimeout)(1000);
  }
}

const flashCommand = {
  command: 'flash',
  describe: 'прошивка минихоста3',
  builder: argv => argv.option('kind', {
    alias: 'k',
    choices: ['rbf', 'tca', 'tcc', 'ctrl']
  }) // .option('offset', {
  //   alias: 'ofs',
  //   default: 0,
  //   number: true,
  //   describe: 'смещение в домене',
  // })
  .option('source', {
    alias: 'src',
    string: true,
    describe: 'загрузить данные из файла'
  }).option('execute', {
    alias: 'exec',
    string: true,
    describe: 'выполнить программу после записи'
  }) // .option('hex', {
  //   boolean: true,
  //   describe: 'использовать шестнадцатиричный формат',
  // })
  // .option('dec', {
  //   boolean: true,
  //   describe: 'использовать десятичный двубайтный формат',
  // })
  // .conflicts('hex', 'dec')
  .example('flash', '$0 flash -m ::1 -k ctrl moduleSelect=0 --src Slim_Ctrl_v5_Mcu_v1.2.txt --exec update').demandOption(['mac', 'm', 'kind', 'source']),
  handler: (0, _handlers.makeAddressHandler)(action)
};
var _default = flashCommand;
exports.default = _default;