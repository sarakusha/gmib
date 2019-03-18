"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _progress = _interopRequireDefault(require("progress"));

var _handlers = require("../handlers");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function readAllFromStdin() {
  const buffers = []; // let rest = max;

  const onData = buffer => {
    // if (rest <= 0) return;
    buffers.push(buffer); // rest -= buffer.length;
  };

  return new Promise((resolve, reject) => {
    process.stdin.on('data', onData).once('end', () => {
      process.stdin.off('data', onData);
      process.stdin.off('error', reject);
      resolve(Buffer.concat(buffers));
    }).once('error', reject);
  });
} // TODO hex


async function action(device, {
  domain,
  offset,
  source,
  hex
}) {
  let buffer;

  let tick = size => {};

  if (source) {
    buffer = await _fs.default.promises.readFile(source);
    const bar = new _progress.default('  downloading [:bar] :rate/bps :percent :current/:total :etas', {
      total: buffer.length,
      width: 20
    });
    tick = bar.tick.bind(bar);
  } else {
    buffer = await readAllFromStdin();
  }

  const onData = ({
    domain: dataDomain,
    length
  }) => {
    if (dataDomain === domain) tick(length);
  };

  device.on('downloadData', onData);

  try {
    await device.download(domain, buffer, offset);
  } finally {
    device.off('downloadData', onData);
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
  handler: (0, _handlers.makeAddressHandler)(action, true)
};
var _default = downloadCommand;
exports.default = _default;