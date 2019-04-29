"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.delay = void 0;

require("source-map-support/register");

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _lodash = _interopRequireDefault(require("lodash"));

var _fs = _interopRequireDefault(require("fs"));

var _Address = _interopRequireWildcard(require("../Address"));

var _ipc = require("../ipc");

var _mib = require("../mib");

var _devices = require("../mib/devices");

var _nibus = require("../nibus");

var _nms = require("../nms");

var _common = require("./common");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:session');

const noop = () => {};

const delay = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

exports.delay = delay;

class NibusSession extends _events.EventEmitter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "connections", []);

    _defineProperty(this, "isStarted", false);

    _defineProperty(this, "socket", void 0);

    _defineProperty(this, "reloadHandler", ports => {
      const prev = this.connections.splice(0, this.connections.length);
      ports.forEach(port => {
        const {
          portInfo: {
            comName
          }
        } = port;

        const index = _lodash.default.findIndex(prev, {
          path: comName
        });

        if (index !== -1) {
          this.connections.push(prev.splice(index, 1)[0]);
        } else {
          this.addHandler(port);
        }
      });
      prev.forEach(connection => this.closeConnection(connection));
    });

    _defineProperty(this, "addHandler", async ({
      portInfo: {
        comName
      },
      description
    }) => {
      debug('add');
      const connection = new _nibus.NibusConnection(comName, description);
      this.connections.push(connection);
      this.emit('add', connection);
      if (process.platform === 'win32') await delay(2);
      this.find(connection);

      _mib.devices.get().filter(device => device.connection == null).reduce(async (promise, device) => {
        await promise;
        debug('start ping');
        const time = await connection.ping(device.address);
        debug(`ping ${time}`);

        if (time !== -1) {
          device.connection = connection;
          /**
           * New connected device
           * @event NibusSession#connected
           * @type IDevice
           */

          this.emit('connected', device); // device.emit('connected');

          debug(`mib-device ${device.address} was connected`);
        }
      }, Promise.resolve()).catch(noop);
    });

    _defineProperty(this, "removeHandler", ({
      portInfo: {
        comName
      }
    }) => {
      const index = this.connections.findIndex(({
        path
      }) => comName === path);

      if (index !== -1) {
        const [connection] = this.connections.splice(index, 1);
        this.closeConnection(connection);
      }
    });
  }

  closeConnection(connection) {
    connection.close();

    _mib.devices.get().filter(device => device.connection === connection).forEach(device => {
      device.connection = undefined;
      this.emit('disconnected', device);
      debug(`mib-device ${connection.path}#${device.address} was disconnected`);
    });

    this.emit('remove', connection);
  }

  find(connection) {
    const {
      description
    } = connection;
    const descriptions = Array.isArray(description.select) ? description.select : [description];
    const baseCategory = Array.isArray(description.select) ? description.category : null;
    descriptions.forEach(descr => {
      const {
        category
      } = descr;

      switch (descr.find) {
        case 'sarp':
          {
            let {
              type
            } = descr;

            if (type === undefined) {
              const mib = JSON.parse(_fs.default.readFileSync((0, _devices.getMibFile)(descr.mib)).toString());
              const {
                types
              } = mib;
              const device = types[mib.device];
              type = (0, _mib.toInt)(device.appinfo.device_type);
            }

            connection.once('sarp', sarpDatagram => {
              if (baseCategory && connection.description.category !== baseCategory) return;

              if (baseCategory && connection.description.category === baseCategory) {
                debug(`category was changed: ${connection.description.category} => ${category}`);
                connection.description = descr;
              }

              const address = new _Address.default(sarpDatagram.mac);
              debug(`device ${category}[${address}] was found on ${connection.path}`);
              this.emit('found', {
                connection,
                category,
                address
              });
            });
            connection.findByType(type).catch(noop);
            break;
          }

        case 'version':
          connection.sendDatagram((0, _nms.createNmsRead)(_Address.default.empty, 2)).then(datagram => {
            if (!datagram || Array.isArray(datagram)) return;

            if (connection.description.category === 'ftdi') {
              debug(`category was changed: ${connection.description.category} => ${category}`);
              connection.description = descr;
            }

            const address = new _Address.default(datagram.source.mac);
            this.emit('found', {
              connection,
              category,
              address
            });
            debug(`device ${category}[${address}] was found on ${connection.path}`);
          }, noop);
          break;

        default:
          this.emit('pureConnection', connection);
          break;
      }
    });
  } // public async start(watch = true) {
  //   if (this.isStarted) return;
  //   const { detection } = detector;
  //   if (detection == null) throw new Error('detection is N/A');
  //   detector.on('add', this.addHandler);
  //   detector.on('remove', this.removeHandler);
  //   await detector.getPorts();
  //
  //   if (watch) detector.start();
  //   this.isStarted = true;
  //   process.once('SIGINT', () => this.stop());
  //   process.once('SIGTERM', () => this.stop());
  //   /**
  //    * @event NibusService#start
  //    */
  //   this.emit('start');
  //   debug('started');
  // }
  //


  start() {
    return new Promise((resolve, reject) => {
      if (this.isStarted) return resolve(this.connections.length);
      this.isStarted = true;
      this.socket = _ipc.Client.connect(_common.PATH);
      this.socket.once('error', error => {
        console.error('error while start nibus.service', error.message);
        this.close();
        reject(error);
      });
      this.socket.on('ports', this.reloadHandler);
      this.socket.on('add', this.addHandler);
      this.socket.on('remove', this.removeHandler);
      this.socket.once('ports', ports => {
        resolve(ports.length);
        this.emit('start');
      });
      this.socket.once('close', () => this.close());
    });
  } // tslint:disable-next-line:function-name


  _connectDevice(device, connection) {
    if (device.connection === connection) return;
    device.connection = connection;
    const event = connection ? 'connected' : 'disconnected';
    process.nextTick(() => this.emit(event, device)); // device.emit('connected');

    debug(`mib-device [${device.address}] was ${event}`);
  }

  close() {
    if (!this.isStarted) return;
    this.isStarted = false;
    debug('close');
    /**
     * @event NibusSession#close
     */

    this.emit('close'); // detector.stop();

    this.connections.splice(0, this.connections.length).forEach(connection => this.closeConnection(connection));
    this.socket && this.socket.destroy(); // this.removeAllListeners();
  } //


  async pingDevice(device) {
    const {
      connections
    } = this;

    if (device.connection && connections.includes(device.connection)) {
      const timeout = await device.connection.ping(device.address);
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
    const [timeout, connection] = await Promise.race(acceptables.map(connection => connection.ping(device.address).then(t => [t, connection])));

    if (timeout === -1) {
      // ping(acceptables[0], device.address);
      return -1;
    }

    this._connectDevice(device, connection);

    return timeout;
  }

  async ping(address) {
    const {
      connections
    } = this;
    const addr = new _Address.default(address);
    if (connections.length === 0) return Promise.resolve(-1);
    return Promise.race(connections.map(connection => connection.ping(addr)));
  }

  get ports() {
    return this.connections.length;
  }

}

const session = new NibusSession();

_mib.devices.on('new', device => {
  if (!device.connection) {
    session.pingDevice(device).catch(noop);
  }
});

_mib.devices.on('delete', device => {
  if (device.connection) {
    device.connection = undefined;
    session.emit('disconnected', device); // device.emit('disconnected');
  }
});

session.on('found', ({
  address,
  connection
}) => {
  console.assert(address.type === _Address.AddressType.mac || address.type === 'empty', 'mac-address expected');

  const devs = _mib.devices.find(address);

  if (devs && devs.length === 1) {
    session._connectDevice(devs[0], connection);
  }
});
process.on('SIGINT', () => session.close());
process.on('SIGTERM', () => session.close());
var _default = session;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL3Nlc3Npb24udHMiXSwibmFtZXMiOlsiZGVidWciLCJub29wIiwiZGVsYXkiLCJzZWNvbmRzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwiTmlidXNTZXNzaW9uIiwiRXZlbnRFbWl0dGVyIiwicG9ydHMiLCJwcmV2IiwiY29ubmVjdGlvbnMiLCJzcGxpY2UiLCJsZW5ndGgiLCJmb3JFYWNoIiwicG9ydCIsInBvcnRJbmZvIiwiY29tTmFtZSIsImluZGV4IiwiXyIsImZpbmRJbmRleCIsInBhdGgiLCJwdXNoIiwiYWRkSGFuZGxlciIsImNvbm5lY3Rpb24iLCJjbG9zZUNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiIsIk5pYnVzQ29ubmVjdGlvbiIsImVtaXQiLCJwcm9jZXNzIiwicGxhdGZvcm0iLCJmaW5kIiwiZGV2aWNlcyIsImdldCIsImZpbHRlciIsImRldmljZSIsInJlZHVjZSIsInByb21pc2UiLCJ0aW1lIiwicGluZyIsImFkZHJlc3MiLCJjYXRjaCIsImNsb3NlIiwidW5kZWZpbmVkIiwiZGVzY3JpcHRpb25zIiwiQXJyYXkiLCJpc0FycmF5Iiwic2VsZWN0IiwiYmFzZUNhdGVnb3J5IiwiY2F0ZWdvcnkiLCJkZXNjciIsInR5cGUiLCJtaWIiLCJKU09OIiwicGFyc2UiLCJmcyIsInJlYWRGaWxlU3luYyIsInRvU3RyaW5nIiwidHlwZXMiLCJhcHBpbmZvIiwiZGV2aWNlX3R5cGUiLCJvbmNlIiwic2FycERhdGFncmFtIiwiQWRkcmVzcyIsIm1hYyIsImZpbmRCeVR5cGUiLCJzZW5kRGF0YWdyYW0iLCJlbXB0eSIsInRoZW4iLCJkYXRhZ3JhbSIsInNvdXJjZSIsInN0YXJ0IiwicmVqZWN0IiwiaXNTdGFydGVkIiwic29ja2V0IiwiQ2xpZW50IiwiY29ubmVjdCIsIlBBVEgiLCJlcnJvciIsImNvbnNvbGUiLCJtZXNzYWdlIiwib24iLCJyZWxvYWRIYW5kbGVyIiwicmVtb3ZlSGFuZGxlciIsIl9jb25uZWN0RGV2aWNlIiwiZXZlbnQiLCJuZXh0VGljayIsImRlc3Ryb3kiLCJwaW5nRGV2aWNlIiwiaW5jbHVkZXMiLCJ0aW1lb3V0IiwiUmVmbGVjdCIsImdldE1ldGFkYXRhIiwib2NjdXBpZWQiLCJtYXAiLCJsaW5rIiwiYWNjZXB0YWJsZXMiLCJkaWZmZXJlbmNlIiwicmFjZSIsInQiLCJhZGRyIiwic2Vzc2lvbiIsImFzc2VydCIsIkFkZHJlc3NUeXBlIiwiZGV2cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7Ozs7Ozs7O0FBR0EsTUFBTUEsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDs7QUFDQSxNQUFNQyxJQUFJLEdBQUcsTUFBTSxDQUFFLENBQXJCOztBQUNPLE1BQU1DLEtBQUssR0FBSUMsT0FBRCxJQUNuQixJQUFJQyxPQUFKLENBQVlDLE9BQU8sSUFBSUMsVUFBVSxDQUFDRCxPQUFELEVBQVVGLE9BQU8sR0FBRyxJQUFwQixDQUFqQyxDQURLOzs7O0FBZ0NQLE1BQU1JLFlBQU4sU0FBMkJDLG9CQUEzQixDQUF3QztBQUFBO0FBQUE7O0FBQUEseUNBQ1ksRUFEWjs7QUFBQSx1Q0FFbEIsS0FGa0I7O0FBQUE7O0FBQUEsMkNBS2JDLEtBQUQsSUFBdUI7QUFDN0MsWUFBTUMsSUFBSSxHQUFHLEtBQUtDLFdBQUwsQ0FBaUJDLE1BQWpCLENBQXdCLENBQXhCLEVBQTJCLEtBQUtELFdBQUwsQ0FBaUJFLE1BQTVDLENBQWI7QUFDQUosTUFBQUEsS0FBSyxDQUFDSyxPQUFOLENBQWVDLElBQUQsSUFBVTtBQUN0QixjQUFNO0FBQUVDLFVBQUFBLFFBQVEsRUFBRTtBQUFFQyxZQUFBQTtBQUFGO0FBQVosWUFBNEJGLElBQWxDOztBQUNBLGNBQU1HLEtBQUssR0FBR0MsZ0JBQUVDLFNBQUYsQ0FBWVYsSUFBWixFQUFrQjtBQUFFVyxVQUFBQSxJQUFJLEVBQUVKO0FBQVIsU0FBbEIsQ0FB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Q0FBQ1csSUFBUixLQUFpQixPQUR2RCxFQUVFLHNCQUZGOztBQUlBLFFBQU1xRCxJQUFJLEdBQUd4RSxhQUFRRCxJQUFSLENBQWFTLE9BQWIsQ0FBYjs7QUFDQSxNQUFJZ0UsSUFBSSxJQUFJQSxJQUFJLENBQUMzRixNQUFMLEtBQWdCLENBQTVCLEVBQStCO0FBQzdCd0YsSUFBQUEsT0FBTyxDQUFDakIsY0FBUixDQUF1Qm9CLElBQUksQ0FBQyxDQUFELENBQTNCLEVBQWdDaEYsVUFBaEM7QUFDRDtBQUNGLENBVEQ7QUFXQUssT0FBTyxDQUFDb0QsRUFBUixDQUFXLFFBQVgsRUFBcUIsTUFBTW9CLE9BQU8sQ0FBQzNELEtBQVIsRUFBM0I7QUFDQWIsT0FBTyxDQUFDb0QsRUFBUixDQUFXLFNBQVgsRUFBc0IsTUFBTW9CLE9BQU8sQ0FBQzNELEtBQVIsRUFBNUI7ZUFFZTJELE8iLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gT09PIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgeyBTb2NrZXQgfSBmcm9tICduZXQnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBBZGRyZXNzLCB7IEFkZHJlc3NQYXJhbSwgQWRkcmVzc1R5cGUgfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IENsaWVudCwgSVBvcnRBcmcgfSBmcm9tICcuLi9pcGMnO1xuaW1wb3J0IHsgZGV2aWNlcywgSURldmljZSwgdG9JbnQgfSBmcm9tICcuLi9taWInO1xuaW1wb3J0IHsgZ2V0TWliRmlsZSwgSU1pYkRldmljZVR5cGUgfSBmcm9tICcuLi9taWIvZGV2aWNlcyc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjcmVhdGVObXNSZWFkIH0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBTYXJwRGF0YWdyYW0gZnJvbSAnLi4vc2FycC9TYXJwRGF0YWdyYW0nO1xuaW1wb3J0IHsgUEFUSCB9IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IENhdGVnb3J5IH0gZnJvbSAnLi9Lbm93blBvcnRzJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOnNlc3Npb24nKTtcbmNvbnN0IG5vb3AgPSAoKSA9PiB7fTtcbmV4cG9ydCBjb25zdCBkZWxheSA9IChzZWNvbmRzOiBudW1iZXIpID0+XG4gIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBzZWNvbmRzICogMTAwMCkpO1xuXG5leHBvcnQgdHlwZSBGb3VuZExpc3RlbmVyID1cbiAgKGFyZzogeyBjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24sIGNhdGVnb3J5OiBDYXRlZ29yeSwgYWRkcmVzczogQWRkcmVzcyB9KSA9PiB2b2lkO1xuXG5leHBvcnQgdHlwZSBDb25uZWN0aW9uTGlzdGVuZXIgPSAoY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgRGV2aWNlTGlzdGVuZXIgPSAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkO1xuXG5kZWNsYXJlIGludGVyZmFjZSBOaWJ1c1Nlc3Npb24ge1xuICBvbihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAncHVyZUNvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikgPT4gdm9pZCk6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAncHVyZUNvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikgPT4gdm9pZCk6IHRoaXM7XG4gIG9mZihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIG9mZihldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3B1cmVDb25uZWN0aW9uJywgbGlzdGVuZXI6IChjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pID0+IHZvaWQpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAncHVyZUNvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikgPT4gdm9pZCk6IHRoaXM7XG59XG5cbmNsYXNzIE5pYnVzU2Vzc2lvbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgY29ubmVjdGlvbnM6IE5pYnVzQ29ubmVjdGlvbltdID0gW107XG4gIHByaXZhdGUgaXNTdGFydGVkID0gZmFsc2U7XG4gIHByaXZhdGUgc29ja2V0PzogU29ja2V0OyAvLyA9IENsaWVudC5jb25uZWN0KFBBVEgpO1xuXG4gIHByaXZhdGUgcmVsb2FkSGFuZGxlciA9IChwb3J0czogSVBvcnRBcmdbXSkgPT4ge1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLmNvbm5lY3Rpb25zLnNwbGljZSgwLCB0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCk7XG4gICAgcG9ydHMuZm9yRWFjaCgocG9ydCkgPT4ge1xuICAgICAgY29uc3QgeyBwb3J0SW5mbzogeyBjb21OYW1lIH0gfSA9IHBvcnQ7XG4gICAgICBjb25zdCBpbmRleCA9IF8uZmluZEluZGV4KHByZXYsIHsgcGF0aDogY29tTmFtZSB9KTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0aW9ucy5wdXNoKHByZXYuc3BsaWNlKGluZGV4LCAxKVswXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmFkZEhhbmRsZXIocG9ydCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcHJldi5mb3JFYWNoKGNvbm5lY3Rpb24gPT4gdGhpcy5jbG9zZUNvbm5lY3Rpb24oY29ubmVjdGlvbikpO1xuICB9O1xuXG4gIHByaXZhdGUgYWRkSGFuZGxlciA9IGFzeW5jICh7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSwgZGVzY3JpcHRpb24gfTogSVBvcnRBcmcpID0+IHtcbiAgICBkZWJ1ZygnYWRkJyk7XG4gICAgY29uc3QgY29ubmVjdGlvbiA9IG5ldyBOaWJ1c0Nvbm5lY3Rpb24oY29tTmFtZSwgZGVzY3JpcHRpb24pO1xuICAgIHRoaXMuY29ubmVjdGlvbnMucHVzaChjb25uZWN0aW9uKTtcbiAgICB0aGlzLmVtaXQoJ2FkZCcsIGNvbm5lY3Rpb24pO1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSBhd2FpdCBkZWxheSgyKTtcbiAgICB0aGlzLmZpbmQoY29ubmVjdGlvbik7XG4gICAgZGV2aWNlcy5nZXQoKVxuICAgICAgLmZpbHRlcihkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24gPT0gbnVsbClcbiAgICAgIC5yZWR1Y2UoYXN5bmMgKHByb21pc2UsIGRldmljZSkgPT4ge1xuICAgICAgICBhd2FpdCBwcm9taXNlO1xuICAgICAgICBkZWJ1Zygnc3RhcnQgcGluZycpO1xuICAgICAgICBjb25zdCB0aW1lID0gYXdhaXQgY29ubmVjdGlvbi5waW5nKGRldmljZS5hZGRyZXNzKTtcbiAgICAgICAgZGVidWcoYHBpbmcgJHt0aW1lfWApO1xuICAgICAgICBpZiAodGltZSAhPT0gLTEpIHtcbiAgICAgICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogTmV3IGNvbm5lY3RlZCBkZXZpY2VcbiAgICAgICAgICAgKiBAZXZlbnQgTmlidXNTZXNzaW9uI2Nvbm5lY3RlZFxuICAgICAgICAgICAqIEB0eXBlIElEZXZpY2VcbiAgICAgICAgICAgKi9cbiAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAgICAgLy8gZGV2aWNlLmVtaXQoJ2Nvbm5lY3RlZCcpO1xuICAgICAgICAgIGRlYnVnKGBtaWItZGV2aWNlICR7ZGV2aWNlLmFkZHJlc3N9IHdhcyBjb25uZWN0ZWRgKTtcbiAgICAgICAgfVxuICAgICAgfSwgUHJvbWlzZS5yZXNvbHZlKCkpXG4gICAgICAuY2F0Y2gobm9vcCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBjbG9zZUNvbm5lY3Rpb24oY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgIGRldmljZXMuZ2V0KClcbiAgICAgIC5maWx0ZXIoZGV2aWNlID0+IGRldmljZS5jb25uZWN0aW9uID09PSBjb25uZWN0aW9uKVxuICAgICAgLmZvckVhY2goKGRldmljZSkgPT4ge1xuICAgICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0ZWQnLCBkZXZpY2UpO1xuICAgICAgICBkZWJ1ZyhgbWliLWRldmljZSAke2Nvbm5lY3Rpb24ucGF0aH0jJHtkZXZpY2UuYWRkcmVzc30gd2FzIGRpc2Nvbm5lY3RlZGApO1xuICAgICAgfSk7XG4gICAgdGhpcy5lbWl0KCdyZW1vdmUnLCBjb25uZWN0aW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlSGFuZGxlciA9ICh7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSB9OiBJUG9ydEFyZykgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jb25uZWN0aW9ucy5maW5kSW5kZXgoKHsgcGF0aCB9KSA9PiBjb21OYW1lID09PSBwYXRoKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBbY29ubmVjdGlvbl0gPSB0aGlzLmNvbm5lY3Rpb25zLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKTtcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSBmaW5kKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHsgZGVzY3JpcHRpb24gfSA9IGNvbm5lY3Rpb247XG4gICAgY29uc3QgZGVzY3JpcHRpb25zID0gQXJyYXkuaXNBcnJheShkZXNjcmlwdGlvbi5zZWxlY3QpID8gZGVzY3JpcHRpb24uc2VsZWN0IDogW2Rlc2NyaXB0aW9uXTtcbiAgICBjb25zdCBiYXNlQ2F0ZWdvcnkgPSBBcnJheS5pc0FycmF5KGRlc2NyaXB0aW9uLnNlbGVjdCkgPyBkZXNjcmlwdGlvbi5jYXRlZ29yeSA6IG51bGw7XG4gICAgZGVzY3JpcHRpb25zLmZvckVhY2goKGRlc2NyKSA9PiB7XG4gICAgICBjb25zdCB7IGNhdGVnb3J5IH0gPSBkZXNjcjtcbiAgICAgIHN3aXRjaCAoZGVzY3IuZmluZCkge1xuICAgICAgICBjYXNlICdzYXJwJzoge1xuICAgICAgICAgIGxldCB7IHR5cGUgfSA9IGRlc2NyO1xuICAgICAgICAgIGlmICh0eXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pYiA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGdldE1pYkZpbGUoZGVzY3IubWliISkpLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgY29uc3QgeyB0eXBlcyB9ID0gbWliO1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gICAgICAgICAgICB0eXBlID0gdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25uZWN0aW9uLm9uY2UoJ3NhcnAnLCAoc2FycERhdGFncmFtOiBTYXJwRGF0YWdyYW0pID0+IHtcbiAgICAgICAgICAgIGlmIChiYXNlQ2F0ZWdvcnkgJiYgY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5jYXRlZ29yeSAhPT0gYmFzZUNhdGVnb3J5KSByZXR1cm47XG4gICAgICAgICAgICBpZiAoYmFzZUNhdGVnb3J5ICYmIGNvbm5lY3Rpb24uZGVzY3JpcHRpb24uY2F0ZWdvcnkgPT09IGJhc2VDYXRlZ29yeSkge1xuICAgICAgICAgICAgICBkZWJ1ZyhgY2F0ZWdvcnkgd2FzIGNoYW5nZWQ6ICR7Y29ubmVjdGlvbi5kZXNjcmlwdGlvbi5jYXRlZ29yeX0gPT4gJHtjYXRlZ29yeX1gKTtcbiAgICAgICAgICAgICAgY29ubmVjdGlvbi5kZXNjcmlwdGlvbiA9IGRlc2NyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9IG5ldyBBZGRyZXNzKHNhcnBEYXRhZ3JhbS5tYWMpO1xuICAgICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoXG4gICAgICAgICAgICAgICdmb3VuZCcsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbm5lY3Rpb24uZmluZEJ5VHlwZSh0eXBlKS5jYXRjaChub29wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlICd2ZXJzaW9uJzpcbiAgICAgICAgICBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShjcmVhdGVObXNSZWFkKEFkZHJlc3MuZW1wdHksIDIpKVxuICAgICAgICAgICAgLnRoZW4oKGRhdGFncmFtKSA9PiB7XG4gICAgICAgICAgICAgIGlmICghZGF0YWdyYW0gfHwgQXJyYXkuaXNBcnJheShkYXRhZ3JhbSkpIHJldHVybjtcbiAgICAgICAgICAgICAgaWYgKGNvbm5lY3Rpb24uZGVzY3JpcHRpb24uY2F0ZWdvcnkgPT09ICdmdGRpJykge1xuICAgICAgICAgICAgICAgIGRlYnVnKGBjYXRlZ29yeSB3YXMgY2hhbmdlZDogJHtjb25uZWN0aW9uLmRlc2NyaXB0aW9uLmNhdGVnb3J5fSA9PiAke2NhdGVnb3J5fWApO1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb24uZGVzY3JpcHRpb24gPSBkZXNjcjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBhZGRyZXNzID0gbmV3IEFkZHJlc3MoZGF0YWdyYW0uc291cmNlLm1hYyk7XG4gICAgICAgICAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgICAgICAgICAnZm91bmQnLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGNvbm5lY3Rpb24sXG4gICAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgICB9LCBub29wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aGlzLmVtaXQoJ3B1cmVDb25uZWN0aW9uJywgY29ubmVjdGlvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBwdWJsaWMgYXN5bmMgc3RhcnQod2F0Y2ggPSB0cnVlKSB7XG4gIC8vICAgaWYgKHRoaXMuaXNTdGFydGVkKSByZXR1cm47XG4gIC8vICAgY29uc3QgeyBkZXRlY3Rpb24gfSA9IGRldGVjdG9yO1xuICAvLyAgIGlmIChkZXRlY3Rpb24gPT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKCdkZXRlY3Rpb24gaXMgTi9BJyk7XG4gIC8vICAgZGV0ZWN0b3Iub24oJ2FkZCcsIHRoaXMuYWRkSGFuZGxlcik7XG4gIC8vICAgZGV0ZWN0b3Iub24oJ3JlbW92ZScsIHRoaXMucmVtb3ZlSGFuZGxlcik7XG4gIC8vICAgYXdhaXQgZGV0ZWN0b3IuZ2V0UG9ydHMoKTtcbiAgLy9cbiAgLy8gICBpZiAod2F0Y2gpIGRldGVjdG9yLnN0YXJ0KCk7XG4gIC8vICAgdGhpcy5pc1N0YXJ0ZWQgPSB0cnVlO1xuICAvLyAgIHByb2Nlc3Mub25jZSgnU0lHSU5UJywgKCkgPT4gdGhpcy5zdG9wKCkpO1xuICAvLyAgIHByb2Nlc3Mub25jZSgnU0lHVEVSTScsICgpID0+IHRoaXMuc3RvcCgpKTtcbiAgLy8gICAvKipcbiAgLy8gICAgKiBAZXZlbnQgTmlidXNTZXJ2aWNlI3N0YXJ0XG4gIC8vICAgICovXG4gIC8vICAgdGhpcy5lbWl0KCdzdGFydCcpO1xuICAvLyAgIGRlYnVnKCdzdGFydGVkJyk7XG4gIC8vIH1cbiAgLy9cbiAgc3RhcnQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNTdGFydGVkKSByZXR1cm4gcmVzb2x2ZSh0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCk7XG4gICAgICB0aGlzLmlzU3RhcnRlZCA9IHRydWU7XG4gICAgICB0aGlzLnNvY2tldCA9IENsaWVudC5jb25uZWN0KFBBVEgpO1xuICAgICAgdGhpcy5zb2NrZXQub25jZSgnZXJyb3InLCAoZXJyb3IpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3Igd2hpbGUgc3RhcnQgbmlidXMuc2VydmljZScsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdwb3J0cycsIHRoaXMucmVsb2FkSGFuZGxlcik7XG4gICAgICB0aGlzLnNvY2tldC5vbignYWRkJywgdGhpcy5hZGRIYW5kbGVyKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUhhbmRsZXIpO1xuICAgICAgdGhpcy5zb2NrZXQub25jZSgncG9ydHMnLCAocG9ydHMpID0+IHtcbiAgICAgICAgcmVzb2x2ZShwb3J0cy5sZW5ndGgpO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXJ0Jyk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uY2UoJ2Nsb3NlJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpmdW5jdGlvbi1uYW1lXG4gIF9jb25uZWN0RGV2aWNlKGRldmljZTogSURldmljZSwgY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgaWYgKGRldmljZS5jb25uZWN0aW9uID09PSBjb25uZWN0aW9uKSByZXR1cm47XG4gICAgZGV2aWNlLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICAgIGNvbnN0IGV2ZW50ID0gY29ubmVjdGlvbiA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCc7XG4gICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoZXZlbnQsIGRldmljZSkpO1xuICAgIC8vIGRldmljZS5lbWl0KCdjb25uZWN0ZWQnKTtcbiAgICBkZWJ1ZyhgbWliLWRldmljZSBbJHtkZXZpY2UuYWRkcmVzc31dIHdhcyAke2V2ZW50fWApO1xuICB9XG5cbiAgcHVibGljIGNsb3NlKCkge1xuICAgIGlmICghdGhpcy5pc1N0YXJ0ZWQpIHJldHVybjtcbiAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdjbG9zZScpO1xuICAgIC8qKlxuICAgICAqIEBldmVudCBOaWJ1c1Nlc3Npb24jY2xvc2VcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG4gICAgLy8gZGV0ZWN0b3Iuc3RvcCgpO1xuICAgIHRoaXMuY29ubmVjdGlvbnNcbiAgICAgIC5zcGxpY2UoMCwgdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpXG4gICAgICAuZm9yRWFjaChjb25uZWN0aW9uID0+IHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pKTtcbiAgICB0aGlzLnNvY2tldCAmJiB0aGlzLnNvY2tldC5kZXN0cm95KCk7XG4gICAgLy8gdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIC8vXG4gIGFzeW5jIHBpbmdEZXZpY2UoZGV2aWNlOiBJRGV2aWNlKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb25zIH0gPSB0aGlzO1xuICAgIGlmIChkZXZpY2UuY29ubmVjdGlvbiAmJiBjb25uZWN0aW9ucy5pbmNsdWRlcyhkZXZpY2UuY29ubmVjdGlvbikpIHtcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBhd2FpdCBkZXZpY2UuY29ubmVjdGlvbi5waW5nKGRldmljZS5hZGRyZXNzKTtcbiAgICAgIGlmICh0aW1lb3V0ICE9PSAtMSkgcmV0dXJuIHRpbWVvdXQ7XG4gICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgIC8vIGRldmljZS5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBtaWIgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpO1xuICAgIGNvbnN0IG9jY3VwaWVkID0gZGV2aWNlcy5nZXQoKVxuICAgICAgLm1hcChkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24hKVxuICAgICAgLmZpbHRlcihjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24gIT0gbnVsbCAmJiAhY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5saW5rKTtcbiAgICBjb25zdCBhY2NlcHRhYmxlcyA9IF8uZGlmZmVyZW5jZShjb25uZWN0aW9ucywgb2NjdXBpZWQpXG4gICAgICAuZmlsdGVyKCh7IGRlc2NyaXB0aW9uIH0pID0+IGRlc2NyaXB0aW9uLmxpbmsgfHwgZGVzY3JpcHRpb24ubWliID09PSBtaWIpO1xuICAgIGlmIChhY2NlcHRhYmxlcy5sZW5ndGggPT09IDApIHJldHVybiAtMTtcblxuICAgIGNvbnN0IFt0aW1lb3V0LCBjb25uZWN0aW9uXSA9IGF3YWl0IFByb21pc2UucmFjZShhY2NlcHRhYmxlcy5tYXAoXG4gICAgICBjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcylcbiAgICAgICAgLnRoZW4odCA9PiBbdCwgY29ubmVjdGlvbl0gYXMgW251bWJlciwgTmlidXNDb25uZWN0aW9uXSkpKTtcbiAgICBpZiAodGltZW91dCA9PT0gLTEpIHtcbiAgICAgIC8vIHBpbmcoYWNjZXB0YWJsZXNbMF0sIGRldmljZS5hZGRyZXNzKTtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICB0aGlzLl9jb25uZWN0RGV2aWNlKGRldmljZSwgY29ubmVjdGlvbik7XG4gICAgcmV0dXJuIHRpbWVvdXQ7XG4gIH1cblxuICBhc3luYyBwaW5nKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9ucyB9ID0gdGhpcztcbiAgICBjb25zdCBhZGRyID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgtMSk7XG4gICAgcmV0dXJuIFByb21pc2UucmFjZShjb25uZWN0aW9ucy5tYXAoY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uLnBpbmcoYWRkcikpKTtcbiAgfVxuXG4gIGdldCBwb3J0cygpIHtcbiAgICByZXR1cm4gdGhpcy5jb25uZWN0aW9ucy5sZW5ndGg7XG4gIH1cbn1cblxuY29uc3Qgc2Vzc2lvbiA9IG5ldyBOaWJ1c1Nlc3Npb24oKTtcblxuZGV2aWNlcy5vbignbmV3JywgKGRldmljZTogSURldmljZSkgPT4ge1xuICBpZiAoIWRldmljZS5jb25uZWN0aW9uKSB7XG4gICAgc2Vzc2lvbi5waW5nRGV2aWNlKGRldmljZSkuY2F0Y2gobm9vcCk7XG4gIH1cbn0pO1xuXG5kZXZpY2VzLm9uKCdkZWxldGUnLCAoZGV2aWNlOiBJRGV2aWNlKSA9PiB7XG4gIGlmIChkZXZpY2UuY29ubmVjdGlvbikge1xuICAgIGRldmljZS5jb25uZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgIHNlc3Npb24uZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAvLyBkZXZpY2UuZW1pdCgnZGlzY29ubmVjdGVkJyk7XG4gIH1cbn0pO1xuXG5zZXNzaW9uLm9uKCdmb3VuZCcsICh7IGFkZHJlc3MsIGNvbm5lY3Rpb24gfSkgPT4ge1xuICBjb25zb2xlLmFzc2VydChcbiAgICBhZGRyZXNzLnR5cGUgPT09IEFkZHJlc3NUeXBlLm1hYyB8fCBhZGRyZXNzLnR5cGUgPT09ICdlbXB0eScsXG4gICAgJ21hYy1hZGRyZXNzIGV4cGVjdGVkJyxcbiAgKTtcbiAgY29uc3QgZGV2cyA9IGRldmljZXMuZmluZChhZGRyZXNzKTtcbiAgaWYgKGRldnMgJiYgZGV2cy5sZW5ndGggPT09IDEpIHtcbiAgICBzZXNzaW9uLl9jb25uZWN0RGV2aWNlKGRldnNbMF0sIGNvbm5lY3Rpb24pO1xuICB9XG59KTtcblxucHJvY2Vzcy5vbignU0lHSU5UJywgKCkgPT4gc2Vzc2lvbi5jbG9zZSgpKTtcbnByb2Nlc3Mub24oJ1NJR1RFUk0nLCAoKSA9PiBzZXNzaW9uLmNsb3NlKCkpO1xuXG5leHBvcnQgZGVmYXVsdCBzZXNzaW9uO1xuIl19