"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _chalk = _interopRequireDefault(require("chalk"));

var _cliTable = _interopRequireDefault(require("cli-table3"));

var _lodash = _interopRequireDefault(require("lodash"));

var _debug = _interopRequireDefault(require("debug"));

var _Address = _interopRequireDefault(require("../Address"));

var _mib = require("../mib");

var _nibus = require("../nibus");

var _SarpQueryType = _interopRequireDefault(require("../sarp/SarpQueryType"));

var _service = _interopRequireDefault(require("../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('nibus:dump');
let count = 0;

async function dumpDevice(address, connection, argv, mib) {
  const raw = argv.raw;
  const compact = argv.compact;

  const device = _mib.devices.create(address, mib || connection.description.mib);

  device.connection = connection;
  const result = await device.read();
  const rows = Object.keys(result).map(key => {
    const value = raw ? device.getError(key) || device.getRawValue(key) : result[key];
    return {
      value,
      key,
      displayName: Reflect.getMetadata('displayName', device, key)
    };
  });

  const categories = _lodash.default.groupBy(rows, ({
    key
  }) => Reflect.getMetadata('category', device, key) || '');

  console.info(` Устройство ${mib || connection.description.mib} [${address.toString()}]`);
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

      if (!Reflect.getMetadata('isWritable', device, key)) {
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

function findDevices(mibs, connection, argv) {
  count += 1;
  const types = mibs.map(mib => ({
    mib,
    type: Reflect.getMetadata('deviceType', _mib.devices.create(_Address.default.empty, mib))
  }));
  types.forEach(({
    type
  }) => connection.findByType(type));
  connection.on('sarp', datagram => {
    count += 1;
    if (datagram.queryType !== _SarpQueryType.default.ByType) return;
    const responseType = datagram.queryParam.readUInt16BE(3);
    const item = types.find(({
      type
    }) => responseType === type);

    if (!item) {
      debug('Unknown device type');
      return;
    }

    const address = new _Address.default(datagram.mac);
    dumpDevice(address, connection, argv, item.mib).catch(e => console.error('error while dump', e.stack));
  });
}

const dump = {
  command: 'dump',
  describe: 'Выдать дампы устройств',
  builder: {
    deep: {
      boolean: true,
      desc: 'Использовать поиск',
      implies: 'mib'
    }
  },
  handler: argv => new Promise(async resolve => {
    const close = () => {
      clearTimeout(timeout);

      _service.default.close();

      resolve();
    };

    const mibs = argv.mib;
    const mac = argv.mac && new _Address.default(argv.mac);
    count = await _service.default.start();

    const checkMib = mibCategory => !argv.category || argv.category.includes(mibCategory);

    _service.default.on('found', async ({
      address,
      connection,
      category: mibCategory
    }) => {
      if (connection.description.link && argv.deep) {
        findDevices(mibs, connection, argv);
      }

      if (connection.description.mib && (!mac || mac.equals(address)) && checkMib(mibCategory)) {
        await dumpDevice(address, connection, argv);
      }

      count -= 1;

      if (count === 0 && !argv.deep) {
        clearTimeout(timeout);
        process.nextTick(close);
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
var _default = dump;
exports.default = _default;