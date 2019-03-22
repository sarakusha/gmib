"use strict";

var _configstore = _interopRequireDefault(require("configstore"));

var _debug = _interopRequireDefault(require("debug"));

var _lodash = _interopRequireDefault(require("lodash"));

var _package = _interopRequireDefault(require("../../package.json"));

var _ipc = require("../ipc");

var _Server = require("../ipc/Server");

var _mib = require("../mib");

var _devices = require("../mib/devices");

var _nibus = require("../nibus");

var _helper = require("../nibus/helper");

var _common = require("./common");

var _detector = _interopRequireDefault(require("./detector"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const conf = new _configstore.default(_package.default.name, {
  logLevel: 'none',
  omit: ['priority']
}); // debugFactory.enable('nibus:detector,nibus.service');

const debug = (0, _debug.default)('nibus:service');
const debugIn = (0, _debug.default)('nibus:INP<<<');
const debugOut = (0, _debug.default)('nibus:OUT>>>');
debug(`config path: ${conf.path}`);

const noop = () => {};

if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('SIGINT', () => process.emit('SIGINT', 'SIGINT'));
}

const minVersionToInt = str => {
  if (!str) return 0;
  const [high, low] = str.split('.', 2);
  return ((0, _mib.toInt)(high) << 8) + (0, _mib.toInt)(low);
};

async function updateMibTypes() {
  const mibs = await (0, _mib.getMibs)();
  conf.set('mibs', mibs);
  const mibTypes = {};
  mibs.forEach(mib => {
    const mibfile = (0, _mib.getMibFile)(mib);

    const validation = _devices.MibDeviceV.decode(require(mibfile));

    if (validation.isLeft()) {
      debug(`<error>: Invalid mib file ${mibfile}`);
    } else {
      const {
        types
      } = validation.value;
      const device = types[validation.value.device];
      const type = (0, _mib.toInt)(device.appinfo.device_type);
      const minVersion = minVersionToInt(device.appinfo.min_version);
      const mibs = mibTypes[type] || [];
      mibs.push({
        mib,
        minVersion
      });
      mibTypes[type] = _lodash.default.sortBy(mibs, 'minVersion');
    }
  });
  conf.set('mibTypes', mibTypes);
}

updateMibTypes().catch(e => debug(`<error> ${e.message}`)); // const direction = (dir: Direction) => dir === Direction.in ? '<<<' : '>>>';

const decoderIn = new _nibus.NibusDecoder();
decoderIn.on('data', datagram => {
  debugIn(datagram.toString({
    pick: conf.get('pick'),
    omit: conf.get('omit')
  }));
});
const decoderOut = new _nibus.NibusDecoder();
decoderOut.on('data', datagram => {
  debugOut(datagram.toString({
    pick: conf.get('pick'),
    omit: conf.get('omit')
  }));
});
const loggers = {
  none: null,
  hex: (data, dir) => {
    switch (dir) {
      case _Server.Direction.in:
        debugIn((0, _helper.printBuffer)(data));
        break;

      case _Server.Direction.out:
        debugOut((0, _helper.printBuffer)(data));
        break;
    }
  },
  nibus: (data, dir) => {
    switch (dir) {
      case _Server.Direction.in:
        decoderIn.write(data);
        break;

      case _Server.Direction.out:
        decoderOut.write(data);
        break;
    }
  }
};

class NibusService {
  constructor() {
    _defineProperty(this, "server", void 0);

    _defineProperty(this, "isStarted", false);

    _defineProperty(this, "connections", []);

    _defineProperty(this, "logLevelHandler", (client, logLevel, pickFields, omitFields) => {
      logLevel && conf.set('logLevel', logLevel);
      pickFields && conf.set('pick', pickFields);
      omitFields && conf.set('omit', omitFields);
      this.updateLogger();
    });

    _defineProperty(this, "connectionHandler", socket => {
      const {
        server,
        connections
      } = this;
      server.send(socket, 'ports', connections.map(connection => connection.toJSON())).catch(err => {
        debug('<error>', err.stack);
      });
    });

    _defineProperty(this, "addHandler", portInfo => {
      const {
        category
      } = portInfo;
      const mibCategory = _detector.default.detection.mibCategories[category];

      if (mibCategory) {
        const connection = new _ipc.SerialTee(portInfo, mibCategory);
        connection.on('close', comName => this.removeHandler({
          comName
        }));
        this.connections.push(connection);
        this.server.broadcast('add', connection.toJSON()).catch(noop);
        this.updateLogger(connection); // this.find(connection);
      }
    });

    _defineProperty(this, "removeHandler", ({
      comName
    }) => {
      const index = this.connections.findIndex(({
        portInfo: {
          comName: port
        }
      }) => port === comName);

      if (index !== -1) {
        const [connection] = this.connections.splice(index, 1); // debug(`nibus-connection was closed ${connection.description.category}`);

        connection.close();
        this.server.broadcast('remove', connection.toJSON()).catch(noop);
      }
    });

    this.server = new _ipc.Server(_common.PATH);
    this.server.on('connection', this.connectionHandler);
    this.server.on('client:setLogLevel', this.logLevelHandler);
  }

  updateLogger(connection) {
    const logger = loggers[conf.get('logLevel')];
    const connections = connection ? [connection] : this.connections;
    connections.forEach(con => con.setLogger(logger));
  }

  start() {
    if (this.isStarted) return;
    this.isStarted = true;
    const {
      detection
    } = _detector.default;
    if (detection == null) throw new Error('detection is N/A');

    _detector.default.on('add', this.addHandler);

    _detector.default.on('remove', this.removeHandler);

    _detector.default.getPorts().catch(err => {
      console.error('error while get ports', err.stack);
    });

    _detector.default.start();

    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
    /**
     * @event NibusService#start
     */

    debug('started');
  }

  stop() {
    if (!this.isStarted) return;
    const connections = this.connections.splice(0, this.connections.length);

    if (connections.length) {
      // Хак, нужен чтобы успеть закрыть все соединения, иначе не успевает их закрыть и выходит
      setTimeout(() => {
        connections.forEach(connection => connection.close());
      }, 0);
    }

    _detector.default.removeListener('add', this.addHandler);

    _detector.default.removeListener('remove', this.removeHandler); // detector.stop();


    this.isStarted = false;
    debug('stopped');
  }

  get path() {
    return this.server.path;
  }

}

const service = new NibusService();
service.start();