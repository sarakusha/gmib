"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

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
const readModule = {
  command: 'read',
  describe: 'read variables',
  builder: argv => argv.demandOption(['id', 'mac']),
  handler: argv => new Promise(async (resolve, reject) => {
    let deviceFound = false;

    const close = err => {
      clearTimeout(timeout);

      _service.default.close();

      err !== undefined && reject(err) || !deviceFound && reject('Устройство не найдено') || resolve();
    };

    const mac = new _Address.default(argv.mac);
    let count = await _service.default.start();

    async function read(address, connection, mibOrType) {
      count += 1;
      deviceFound = true;

      const device = _mib.devices.create(address, mibOrType);

      device.connection = connection;
      const idOrName = argv.id;

      if (idOrName) {
        const id = device.getId(idOrName);
        const value = Object.values((await device.read(id)))[0];

        if (!value.error) {
          console.log(JSON.stringify(argv.raw ? device.getRawValue(id) : value));
        }

        return close(value.error);
      }
    }

    _service.default.on('found', async ({
      address,
      connection
    }) => {
      const {
        description
      } = connection;

      if (mac.equals(address)) {
        if (!argv.mib || description.mib === argv.mib) {
          return read(mac, connection, description.mib);
        }
      } else if (description.link) {
        const [, type] = await connection.getFirmwareVersion(mac);

        if (type) {
          return read(mac, connection, type);
        }
      }

      count -= 1;
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
var _default = readModule;
exports.default = _default;