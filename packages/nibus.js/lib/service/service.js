"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _events = require("events");

var _debug = _interopRequireDefault(require("debug"));

var _Address = _interopRequireDefault(require("../Address"));

var _mib = require("../mib");

var _devices = require("../mib/devices");

var _mib2 = require("../mib/mib");

var _nibus = require("../nibus");

var _nms = require("../nms");

var _detector = _interopRequireDefault(require("./detector"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:service');

function ping(connection, address) {
  const now = Date.now();
  return connection.sendDatagram((0, _nms.createNmsRead)(address, 2)).then(datagram => {
    return Reflect.getOwnMetadata('timeStamp', datagram) - now;
  }).catch(reson => {
    debug(`ping failed ${reson}`);
    return -1;
  });
}
/**
 * @fires add
 * @fires remove
 * @fires connected
 * @fires disconnected
 * @fires start
 * @fires stop
 * @fires found
 */


class NibusService extends _events.EventEmitter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "connections", []);

    _defineProperty(this, "isStarted", false);

    _defineProperty(this, "addHandler", ({
      comName,
      category
    }) => {
      const mibCategory = _detector.default.detection.mibCategories[category];

      if (mibCategory) {
        const connection = new _nibus.NibusConnection(comName, mibCategory);
        this.connections.push(connection); // debug(`new nibus-connection: ${mibCategory.category}`);

        /**
         * Add new port with category
         * @event NibusService#add
         * @param {NibusConnection} connection
         */

        this.emit('add', connection);
        this.find(connection);

        _mib.devices.get().filter(device => device.connection == null).reduce(async (promise, device) => {
          await promise;
          const time = await ping(connection, device.address);
          debug(`ping ${time}`);

          if (time !== -1) {
            device.connection = connection;
            /**
             * New connected device
             * @event NibusService#connected
             * @type IDevice
             */

            this.emit('connected', device); // device.emit('connected');

            debug(`mib-device ${device.address} was connected`);
          }
        }, Promise.resolve()).catch();
      }
    });

    _defineProperty(this, "removeHandler", ({
      comName
    }) => {
      const index = this.connections.findIndex(({
        port
      }) => port === comName);

      if (index !== -1) {
        const [connection] = this.connections.splice(index, 1); // debug(`nibus-connection was closed ${connection.description.category}`);

        connection.close();

        _mib.devices.get().filter(device => device.connection === connection).forEach(device => {
          device.connection = undefined;
          /**
           * device was disconnected
           * @event NibusService#disconnected
           * @param {IDevice} device
           */

          this.emit('disconnected', device); // device.emit('disconnected');

          debug(`mib-device ${device.address} was disconnected`);
        });
        /**
         * @event NibusService#remove
         * @param {NibusConnection} connection
         */


        this.emit('remove', connection);
      }
    });
  }

  find(connection) {
    const {
      description
    } = connection;

    switch (description.find) {
      case 'sarp':
        {
          const {
            category
          } = description;

          const mib = require((0, _devices.getMibFile)(description.mib));

          const {
            types
          } = mib;
          const device = types[mib.device];
          const mibType = (0, _mib2.toInt)(device.appinfo.device_type);
          connection.once('sarp', sarpDatagram => {
            /**
             * @event found
             */
            const address = new _Address.default(sarpDatagram.mac);
            this.emit('found', {
              connection,
              category,
              address
            });
            debug(`device ${category}[${address}] was found`);
          });
          connection.findByType(mibType).catch();
          break;
        }

      case 'version':
        // TODO: get mac
        break;

      default:
        break;
    }
  }

  start() {
    if (this.isStarted) return;
    const {
      detection,
      ports
    } = _detector.default;
    if (detection == null) throw new Error('detection is N/A');
    this.connections = ports.filter(({
      category
    }) => category != null && detection.mibCategories[category] != null).map(({
      comName,
      category
    }) => new _nibus.NibusConnection(comName, detection.mibCategories[category]));
    this.connections.length && debug(`It was created ${this.connections.length} nibus-connection(s): ${this.connections.map(connection => connection.description.category).join()}`);
    this.connections.forEach(connection => {
      this.emit('add', connection);
      this.find(connection);
    });

    _detector.default.on('add', this.addHandler);

    _detector.default.on('remove', this.removeHandler);

    _detector.default.start();

    this.isStarted = true;
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
    /**
     * @event NibusService#start
     */

    this.emit('start');
    debug('started');
  }

  stop() {
    if (!this.isStarted) return;
    this.isStarted = false;
    debug('stopped');
    /**
     * @event NibusService#stop
     */

    this.emit('stop');

    _detector.default.stop();

    this.connections.forEach(connection => connection.close());

    _mib.devices.get().forEach(device => {
      device.connection = undefined;
      debug(`mib-device ${device.address} was disconnected`); // device.emit('disconnected');
    });

    this.connections.length = 0;

    _detector.default.removeListener('add', this.addHandler);

    _detector.default.removeListener('remove', this.removeHandler);
  }

  async pingDevice(device) {
    if (!this.isStarted) return -1;
    const {
      connections
    } = this;

    if (device.connection && connections.includes(device.connection)) {
      const timeout = await ping(device.connection, device.address);
      if (timeout !== -1) return timeout;
      device.connection = undefined;
      this.emit('disconnected', device); // device.emit('disconnected');
    }

    const mib = Reflect.getMetadata('mib', device);

    const occupied = _mib.devices.get().map(device => device.connection).filter(connection => connection != null && !connection.description.link);

    const acceptables = _lodash.default.difference(connections, occupied).filter(({
      description
    }) => description.link || description.mib === mib);

    if (acceptables.length === 0) return -1;
    const [timeout, connection] = await Promise.race(acceptables.map(connection => ping(connection, device.address).then(t => [t, connection])));

    if (timeout === -1) {
      // ping(acceptables[0], device.address);
      return -1;
    }

    device.connection = connection;
    this.emit('connected', device); // device.emit('connected');

    debug(`mib-device [${device.address}] was connected`);
    return timeout;
  }

}

const service = new NibusService();

_mib.devices.on('new', device => {
  service.pingDevice(device).catch();
});

_mib.devices.on('delete', device => {
  if (device.connection) {
    device.connection = undefined;
    service.emit('disconnected', device); // device.emit('disconnected');
  }
});

var _default = service;
exports.default = _default;