"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _service = _interopRequireDefault(require("../../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout * 1000));

const round = val => Math.round(val * 10) / 10;

const pingCommand = {
  command: 'ping',
  describe: 'пропинговать устройство',
  builder: argv => argv.option('c', {
    alias: 'count',
    describe: 'остановиться после отправки указанного количества ответов',
    number: true
  }).option('t', {
    alias: 'timeout',
    describe: 'задать таймаут в секундах',
    default: 1,
    number: true
  }).demandOption(['m', 'mac']),
  handler: async ({
    count = -1,
    timeout = 1,
    mac,
    quiet,
    raw
  }) => {
    await _service.default.start();
    const stat = [];
    let transmitted = 0;
    process.on('exit', () => {
      const loss = 100 - round(stat.length / transmitted * 100);

      const min = _lodash.default.min(stat);

      const max = _lodash.default.max(stat);

      const avg = round(_lodash.default.mean(stat));
      quiet || raw || console.info(`
${transmitted} пакет(ов) отправлено, ${stat.length} пакет(ов) получено, ${loss}% пакетов потеряно
min/avg/max = ${min || '-'}/${Number.isNaN(avg) ? '-' : avg}/${max || '-'}`);
    });
    let exit = false;
    process.on('SIGINT', () => {
      exit = true;
    });

    while (count - transmitted !== 0 && !exit) {
      const ping = await _service.default.ping(mac);
      if (ping !== -1) stat.push(ping);
      transmitted += 1;
      quiet || raw || console.info(`${mac} ${ping !== -1 ? `${ping} ms` : '*'}`);
      if (count - transmitted === 0) break;
      await delay(timeout);
    }

    _service.default.close();

    if (raw) console.info(stat.length);
    if (stat.length === 0) return Promise.reject();
  }
};
var _default = pingCommand;
exports.default = _default;