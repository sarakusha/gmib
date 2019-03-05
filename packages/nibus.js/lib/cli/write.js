"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _tableLayout = _interopRequireDefault(require("table-layout"));

var _detector = _interopRequireDefault(require("../service/detector"));

var _Address = _interopRequireDefault(require("../Address"));

var _mib = require("../mib");

var _nibus = require("../nibus");

var _service = _interopRequireDefault(require("../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// @ts-ignore
// try {
//   const data = fs.readFileSync(detectionPath, 'utf8');
//
// }
const header = {
  displayName: 'Название',
  value: 'Значение',
  key: 'Имя'
};
const test = {
  command: 'write',
  describe: 'write variables',
  builder: {
    raw: {
      boolean: true,
      default: false,
      description: 'Cырые данные'
    },
    category: {
      alias: 'cat',
      description: 'Только mib-категорию',
      array: true,
      choices: _detector.default.detection && Object.keys(_detector.default.detection.mibCategories)
    },
    id: {
      alias: 'name',
      type: 'string',
      array: true,
      description: 'имя или id переменной'
    }
  },
  handler: async argv => new Promise(async (resolve, reject) => {
    const close = err => {
      _service.default.close();

      err !== undefined && reject(err) || resolve();
    };

    const mac = argv.mac && new _Address.default(argv.mac);
    let count = await _service.default.start();

    const checkMib = mibCategory => !argv.category || argv.category.includes(mibCategory);

    _service.default.on('found', async ({
      address,
      connection,
      category: mibCategory
    }) => {
      if (connection.description.mib && (!mac || mac.equals(address)) && checkMib(mibCategory)) {
        const device = _mib.devices.create(address, connection.description.mib);

        device.connection = connection;
        const idOrName = argv.id;

        if (idOrName) {
          const id = device.getId(idOrName);
          const value = Object.values((await device.read(id)))[0];

          if (!value.error) {
            console.log(argv.raw ? device.getRawValue(id) : value);
          }

          return close(value.error);
        }

        const result = await device.read(); // console.log(JSON.stringify(result));

        const rows = Object.keys(result).map(key => {
          const value = argv.raw ? device.getRawValue(key) : JSON.stringify(result[key]);
          return {
            displayName: Reflect.getMetadata('displayName', device, key),
            // tslint:disable-next-line:object-shorthand-properties-first
            value,
            // tslint:disable-next-line:object-shorthand-properties-first
            key
          };
        });

        const categories = _lodash.default.groupBy(rows, ({
          key
        }) => Reflect.getMetadata('category', device, key) || '');

        Object.keys(categories).forEach(category => {
          const rows = [{
            displayName: (category || '').toUpperCase()
          }, header, ...categories[category]];
          const table = new _tableLayout.default(rows, {
            maxWidth: 100,
            columns: [{
              name: 'displayName',
              width: 50
            }, {
              name: 'value',
              width: 30
            }, {
              name: 'key',
              width: 20
            }]
          });
          console.info(table.toString());
        });
      }

      count -= 1;

      if (count === 0) {
        clearTimeout(timeout);
        process.nextTick(close);
      }
    });

    const timeout = setTimeout(close, (0, _nibus.getNibusTimeout)());
  })
};
var _default = test;
exports.default = _default;