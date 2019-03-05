"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _chalk = _interopRequireDefault(require("chalk"));

var _cliTable = _interopRequireDefault(require("cli-table3"));

var _lodash = _interopRequireDefault(require("lodash"));

var _debug = _interopRequireDefault(require("debug"));

var _Address = _interopRequireDefault(require("../../Address"));

var _mib = require("../../mib");

var _nibus = require("../../nibus");

var _SarpQueryType = _interopRequireDefault(require("../../sarp/SarpQueryType"));

var _service = _interopRequireDefault(require("../../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:dump');
let count = 0;

async function dumpDevice(address, connection, argv, mib) {
  const raw = argv.raw;
  const compact = argv.compact;
  let device;

  if (!mib) {
    const [, type] = await connection.getFirmwareVersion(address);
    device = _mib.devices.create(address, type);
  } else {
    device = _mib.devices.create(address, mib);
  }

  device.connection = connection;
  let ids = [];

  if (argv.name) {
    ids = argv.name.map(name => device.getId(name));
  }

  const result = await device.read(...ids);
  const rows = Object.keys(result).map(key => {
    const value = raw ? device.getError(key) || device.getRawValue(key) : result[key];
    return {
      value,
      key,
      displayName: Reflect.getMetadata('displayName', device, key)
    };
  });
  const proto = Reflect.getPrototypeOf(device);
  device.release();

  const categories = _lodash.default.groupBy(rows, ({
    key
  }) => Reflect.getMetadata('category', proto, key) || '');

  console.info(` Устройство ${Reflect.getMetadata('mib', proto)} [${address.toString()}]`);
  const table = new _cliTable.default({
    head: ['Название', 'Значение', 'Имя'],
    style: {
      compact
    },
    wordWrap: true
  });

  const toRow = ({
    displayName,
    value,
    key
  }) => {
    let val;

    if (value && value.error) {
      val = _chalk.default.red(value.error);
    } else if (value && value.errcode) {
      val = _chalk.default.red(`errcode: ${value.errcode}`);
    } else {
      val = JSON.stringify(value);

      if (!Reflect.getMetadata('isWritable', proto, key)) {
        val = _chalk.default.grey(val);
      }
    }

    return [displayName, val, key];
  };

  Object.keys(categories).forEach(category => {
    const rows = categories[category];

    if (category) {
      table.push([{
        colSpan: 3,
        content: _chalk.default.yellow(category.toUpperCase())
      }]);
    }

    table.push(...rows.map(toRow));
  });
  console.info(table.toString());
}

function findDevices(mib, connection, argv) {
  count += 1;
  const proto = (0, _mib.getMibPrototype)(mib);
  const type = Reflect.getMetadata('deviceType', proto);
  connection.findByType(type).catch(e => debug('error while findByType', e.stack));
  connection.on('sarp', datagram => {
    count += 1;
    if (datagram.queryType !== _SarpQueryType.default.ByType) return;
    const responseType = datagram.queryParam.readUInt16BE(3); // const item = types.find(({ type }) => responseType === type);

    if (responseType !== type) return;
    const address = new _Address.default(datagram.mac);
    dumpDevice(address, connection, argv, mib).catch( // () => {},
    e => console.error('error while dump:', e.message));
  });
}

const dumpCommand = {
  command: 'dump',
  describe: 'Выдать дампы устройств',
  builder: argv => argv.check(argv => {
    if (argv.id && !argv.mac && !argv.mib) {
      throw `Данный аргумент требует следующий дополнительный аргумент:
 id -> mib или id -> mac`;
    }

    return true;
  }),
  handler: argv => new Promise(async (resolve, reject) => {
    const close = err => {
      clearTimeout(timeout);

      _service.default.close();

      if (err) reject(err);else resolve();
    };

    const mac = argv.mac && new _Address.default(argv.mac);
    count = await _service.default.start();

    _service.default.on('found', async ({
      address,
      connection
    }) => {
      try {
        if (connection.description.link) {
          if (mac) {
            count += 1;
            await dumpDevice(mac, connection, argv);
          } else if (argv.mib) {
            findDevices(argv.mib, connection, argv);
          }
        }

        if (connection.description.mib && (!mac || mac.equals(address)) && (!argv.mib || argv.mib === connection.description.mib)) {
          await dumpDevice(address, connection, argv, connection.description.mib);
        }

        count -= 1;

        if (count === 0) {
          clearTimeout(timeout);
          process.nextTick(close);
        }
      } catch (e) {
        close(e.message || e);
      }
    });

    const wait = () => {
      count -= 1;

      if (count > 0) {
        timeout = setTimeout(wait, (0, _nibus.getNibusTimeout)());
      } else {
        close();
      }
    };

    let timeout = setTimeout(wait, (0, _nibus.getNibusTimeout)());
  })
};
var _default = dumpCommand;
exports.default = _default;