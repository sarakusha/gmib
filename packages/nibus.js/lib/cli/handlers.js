"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeAddressHandler = void 0;

var _mib = require("../mib");

var _Address = _interopRequireDefault(require("../Address"));

var _nibus = require("../nibus");

var _service = _interopRequireDefault(require("../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const makeAddressHandler = (action, breakout = false) => args => new Promise(async (resolve, reject) => {
  let hasFound = false;

  const close = err => {
    clearTimeout(timeout);

    _service.default.close();

    if (err || !hasFound) {
      return reject(err || 'Устройство не найдено');
    }

    resolve();
  };

  const mac = new _Address.default(args.mac);
  let count = await _service.default.start(); // const setCount: NibusCounter = (handler = (c: number) => c) => count = handler(count);

  const perform = async (connection, mibOrType, version) => {
    clearTimeout(timeout);

    const device = _mib.devices.create(mac, mibOrType, version);

    device.connection = connection;
    await action(device, args);
    hasFound = true;
  };

  _service.default.on('found', async ({
    address,
    connection
  }) => {
    try {
      if (address.equals(mac) && connection.description.mib) {
        if (!args.mib || args.mib === connection.description.mib) {
          await perform(connection, connection.description.mib);
          if (breakout) return close();
          wait();
        }
      }

      if (address.equals(mac) && connection.description.type || connection.description.link) {
        count += 1;
        const [version, type] = await connection.getVersion(mac);

        if (type) {
          await perform(connection, type, version);
          if (breakout) return close();
          wait();
        }
      }
    } catch (e) {
      close(e.message || e);
    }

    count -= 1;

    if (count === 0) {
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
});

exports.makeAddressHandler = makeAddressHandler;