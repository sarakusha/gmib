"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.action = action;
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _progress = _interopRequireDefault(require("progress"));

var _helper = require("../../nibus/helper");

var _handlers = require("../handlers");

var _write = require("./write");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function action(device, args) {
  const writeArgs = args.out ? { ...args,
    quiet: true
  } : args;
  await (0, _write.action)(device, writeArgs);
  const {
    domain,
    offset,
    size,
    out,
    force,
    hex,
    quiet
  } = args;

  let close = () => {};

  let write;

  let tick = size => {};

  if (out) {
    if (!force && _fs.default.existsSync(out)) {
      throw new Error(`File ${_path.default.resolve(out)} already exists`);
    }

    const ws = _fs.default.createWriteStream(out, {
      encoding: hex ? 'utf8' : 'binary'
    });

    write = data => ws.write(data, err => err && console.error(err.message));

    close = ws.close.bind(ws);
  } else {
    write = data => process.stdout.write(data, err => err && console.error(err.message));
  }

  const dataHandler = ({
    data
  }) => {
    tick(data.length);

    if (hex) {
      write(`${(0, _helper.printBuffer)(data)}${'\n'}`);
    } else {
      write(data);
    }
  };

  device.once('uploadStart', ({
    domainSize
  }) => {
    const total = size || domainSize;

    if (out) {
      const bar = new _progress.default(`  uploading [:bar] ${total <= 50 ? '' : ':rate/bps :percent '}:current/:total :etas`, {
        total: total,
        width: 20
      });
      tick = bar.tick.bind(bar);
    }

    if (hex && !quiet) {
      write(`DOMAIN: ${domain}
OFFSET: ${offset}
SIZE: ${total}
`);
    }
  });
  device.on('uploadData', dataHandler);

  try {
    await device.upload(domain, offset, size);
  } finally {
    device.off('uploadData', dataHandler);
    close();
  }
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
  handler: (0, _handlers.makeAddressHandler)(action, true)
};
var _default = uploadCommand;
exports.default = _default;