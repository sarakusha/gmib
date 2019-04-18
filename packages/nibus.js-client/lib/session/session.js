"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _lodash = _interopRequireDefault(require("lodash"));

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

    _defineProperty(this, "addHandler", ({
      portInfo: {
        comName
      },
      description
    }) => {
      debug('add');
      const connection = new _nibus.NibusConnection(comName, description);
      this.connections.push(connection);
      this.emit('add', connection);
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
      debug(`mib-device ${device.address} was disconnected`);
    });

    this.emit('remove', connection);
  }

  find(connection) {
    const {
      description
    } = connection;
    const descriptions = Array.isArray(description.select) ? description.select : [description];
    descriptions.forEach(description => {
      const {
        category
      } = description;

      switch (description.find) {
        case 'sarp':
          {
            let {
              type
            } = description;

            if (type === undefined) {
              const mib = require((0, _devices.getMibFile)(description.mib));

              const {
                types
              } = mib;
              const device = types[mib.device];
              type = (0, _mib.toInt)(device.appinfo.device_type);
            }

            connection.once('sarp', sarpDatagram => {
              if (connection.description.category === 'ftdi') {
                debug(`category was changed: ${connection.description.category} => ${category}`);
                connection.description = description;
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
              connection.description = description;
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
    return new Promise(resolve => {
      if (this.isStarted) return resolve(this.connections.length);
      this.isStarted = true;
      this.socket = _ipc.Client.connect(_common.PATH);
      this.socket.once('error', error => {
        console.error('error while start nibus.service', error.message);
        this.close();
      });
      this.socket.on('ports', this.reloadHandler);
      this.socket.on('add', this.addHandler);
      this.socket.on('remove', this.removeHandler);
      this.socket.once('ports', ports => {
        resolve(ports.length);
        this.emit('start');
      });
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
    this.socket && this.socket.destroy();
    this.removeAllListeners();
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
  console.assert(address.type === _Address.AddressType.mac, 'mac-address expected');

  const device = _mib.devices.find(address);

  if (device) {
    session._connectDevice(device, connection);
  }
});
process.on('SIGINT', () => session.close());
process.on('SIGTERM', () => session.close());
var _default = session;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL3Nlc3Npb24udHMiXSwibmFtZXMiOlsiZGVidWciLCJub29wIiwiTmlidXNTZXNzaW9uIiwiRXZlbnRFbWl0dGVyIiwicG9ydHMiLCJwcmV2IiwiY29ubmVjdGlvbnMiLCJzcGxpY2UiLCJsZW5ndGgiLCJmb3JFYWNoIiwicG9ydCIsInBvcnRJbmZvIiwiY29tTmFtZSIsImluZGV4IiwiXyIsImZpbmRJbmRleCIsInBhdGgiLCJwdXNoIiwiYWRkSGFuZGxlciIsImNvbm5lY3Rpb24iLCJjbG9zZUNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiIsIk5pYnVzQ29ubmVjdGlvbiIsImVtaXQiLCJmaW5kIiwiZGV2aWNlcyIsImdldCIsImZpbHRlciIsImRldmljZSIsInJlZHVjZSIsInByb21pc2UiLCJ0aW1lIiwicGluZyIsImFkZHJlc3MiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNhdGNoIiwiY2xvc2UiLCJ1bmRlZmluZWQiLCJkZXNjcmlwdGlvbnMiLCJBcnJheSIsImlzQXJyYXkiLCJzZWxlY3QiLCJjYXRlZ29yeSIsInR5cGUiLCJtaWIiLCJyZXF1aXJlIiwidHlwZXMiLCJhcHBpbmZvIiwiZGV2aWNlX3R5cGUiLCJvbmNlIiwic2FycERhdGFncmFtIiwiQWRkcmVzcyIsIm1hYyIsImZpbmRCeVR5cGUiLCJzZW5kRGF0YWdyYW0iLCJlbXB0eSIsInRoZW4iLCJkYXRhZ3JhbSIsInNvdXJjZSIsInN0YXJ0IiwiaXNTdGFydGVkIiwic29ja2V0IiwiQ2xpZW50IiwiY29ubmVjdCIsIlBBVEgiLCJlcnJvciIsImNvbnNvbGUiLCJtZXNzYWdlIiwib24iLCJyZWxvYWRIYW5kbGVyIiwicmVtb3ZlSGFuZGxlciIsIl9jb25uZWN0RGV2aWNlIiwiZXZlbnQiLCJwcm9jZXNzIiwibmV4dFRpY2siLCJkZXN0cm95IiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwicGluZ0RldmljZSIsImluY2x1ZGVzIiwidGltZW91dCIsIlJlZmxlY3QiLCJnZXRNZXRhZGF0YSIsIm9jY3VwaWVkIiwibWFwIiwibGluayIsImFjY2VwdGFibGVzIiwiZGlmZmVyZW5jZSIsInJhY2UiLCJ0IiwiYWRkciIsInNlc3Npb24iLCJhc3NlcnQiLCJBZGRyZXNzVHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7Ozs7Ozs7O0FBR0EsTUFBTUEsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDs7QUFDQSxNQUFNQyxJQUFJLEdBQUcsTUFBTSxDQUFFLENBQXJCOztBQTJCQSxNQUFNQyxZQUFOLFNBQTJCQyxvQkFBM0IsQ0FBd0M7QUFBQTtBQUFBOztBQUFBLHlDQUNZLEVBRFo7O0FBQUEsdUNBRWxCLEtBRmtCOztBQUFBOztBQUFBLDJDQUtiQyxLQUFELElBQXVCO0FBQzdDLFlBQU1DLElBQUksR0FBRyxLQUFLQyxXQUFMLENBQWlCQyxNQUFqQixDQUF3QixDQUF4QixFQUEyQixLQUFLRCxXQUFMLENBQWlCRSxNQUE1QyxDQUFiO0FBQ0FKLE1BQUFBLEtBQUssQ0FBQ0ssT0FBTixDQUFlQyxJQUFELElBQVU7QUFDdEIsY0FBTTtBQUFFQyxVQUFBQSxRQUFRLEVBQUU7QUFBRUMsWUFBQUE7QUFBRjtBQUFaLFlBQTRCRixJQUFsQzs7QUFDQSxjQUFNRyxLQUFLLEdBQUdDLGdCQUFFQyxTQUFGLENBQVlWLElBQVosRUFBa0I7QUFBRVcsVUFBQUEsSUFBSSxFQUFFSjtBQUFSLFNBQWxCLENBQWQ7O0FBQ0EsWUFBSUMsS0FBSyxLQUFLLENBQUMsQ0FBZixFQUFrQjtBQUNoQixlQUFLUCxXQUFMLENBQWlCVyxJQUFqQixDQUFzQlosSUFBSSxDQUFDRSxNQUFMLENBQVlNLEtBQVosRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsQ0FBdEI7QUFDRCxTQUZELE1BRU87QUFDTCxlQUFLSyxVQUFMLENBQWdCUixJQUFoQjtBQUNEO0FBQ0YsT0FSRDtBQVNBTCxNQUFBQSxJQUFJLENBQUNJ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R3JCO0FBQ0Q7QUFDRixDQU5EOztBQVFBK0QsT0FBTyxDQUFDdEIsRUFBUixDQUFXLE9BQVgsRUFBb0IsQ0FBQztBQUFFcEMsRUFBQUEsT0FBRjtBQUFXZCxFQUFBQTtBQUFYLENBQUQsS0FBNkI7QUFDL0NnRCxFQUFBQSxPQUFPLENBQUN5QixNQUFSLENBQWUzRCxPQUFPLENBQUNXLElBQVIsS0FBaUJpRCxxQkFBWXhDLEdBQTVDLEVBQWlELHNCQUFqRDs7QUFDQSxRQUFNekIsTUFBTSxHQUFHSCxhQUFRRCxJQUFSLENBQWFTLE9BQWIsQ0FBZjs7QUFDQSxNQUFJTCxNQUFKLEVBQVk7QUFDVitELElBQUFBLE9BQU8sQ0FBQ25CLGNBQVIsQ0FBdUI1QyxNQUF2QixFQUErQlQsVUFBL0I7QUFDRDtBQUNGLENBTkQ7QUFRQXVELE9BQU8sQ0FBQ0wsRUFBUixDQUFXLFFBQVgsRUFBcUIsTUFBTXNCLE9BQU8sQ0FBQ3RELEtBQVIsRUFBM0I7QUFDQXFDLE9BQU8sQ0FBQ0wsRUFBUixDQUFXLFNBQVgsRUFBc0IsTUFBTXNCLE9BQU8sQ0FBQ3RELEtBQVIsRUFBNUI7ZUFFZXNELE8iLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gT09PIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgeyBTb2NrZXQgfSBmcm9tICduZXQnO1xuaW1wb3J0IEFkZHJlc3MsIHsgQWRkcmVzc1BhcmFtLCBBZGRyZXNzVHlwZSB9IGZyb20gJy4uL0FkZHJlc3MnO1xuaW1wb3J0IHsgQ2xpZW50LCBJUG9ydEFyZyB9IGZyb20gJy4uL2lwYyc7XG5pbXBvcnQgeyBkZXZpY2VzLCBJRGV2aWNlLCB0b0ludCB9IGZyb20gJy4uL21pYic7XG5pbXBvcnQgeyBnZXRNaWJGaWxlLCBJTWliRGV2aWNlVHlwZSB9IGZyb20gJy4uL21pYi9kZXZpY2VzJztcbmltcG9ydCB7IE5pYnVzQ29ubmVjdGlvbiB9IGZyb20gJy4uL25pYnVzJztcbmltcG9ydCB7IGNyZWF0ZU5tc1JlYWQgfSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IFNhcnBEYXRhZ3JhbSBmcm9tICcuLi9zYXJwL1NhcnBEYXRhZ3JhbSc7XG5pbXBvcnQgeyBQQVRIIH0gZnJvbSAnLi9jb21tb24nO1xuaW1wb3J0IHsgQ2F0ZWdvcnkgfSBmcm9tICcuL0tub3duUG9ydHMnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmlidXM6c2Vzc2lvbicpO1xuY29uc3Qgbm9vcCA9ICgpID0+IHt9O1xuXG5leHBvcnQgdHlwZSBGb3VuZExpc3RlbmVyID1cbiAgKGFyZzogeyBjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24sIGNhdGVnb3J5OiBDYXRlZ29yeSwgYWRkcmVzczogQWRkcmVzcyB9KSA9PiB2b2lkO1xuXG5leHBvcnQgdHlwZSBDb25uZWN0aW9uTGlzdGVuZXIgPSAoY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgRGV2aWNlTGlzdGVuZXIgPSAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkO1xuXG5kZWNsYXJlIGludGVyZmFjZSBOaWJ1c1Nlc3Npb24ge1xuICBvbihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdmb3VuZCcsIGxpc3RlbmVyOiBGb3VuZExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG59XG5cbmNsYXNzIE5pYnVzU2Vzc2lvbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgY29ubmVjdGlvbnM6IE5pYnVzQ29ubmVjdGlvbltdID0gW107XG4gIHByaXZhdGUgaXNTdGFydGVkID0gZmFsc2U7XG4gIHByaXZhdGUgc29ja2V0PzogU29ja2V0OyAvLyA9IENsaWVudC5jb25uZWN0KFBBVEgpO1xuXG4gIHByaXZhdGUgcmVsb2FkSGFuZGxlciA9IChwb3J0czogSVBvcnRBcmdbXSkgPT4ge1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLmNvbm5lY3Rpb25zLnNwbGljZSgwLCB0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCk7XG4gICAgcG9ydHMuZm9yRWFjaCgocG9ydCkgPT4ge1xuICAgICAgY29uc3QgeyBwb3J0SW5mbzogeyBjb21OYW1lIH0gfSA9IHBvcnQ7XG4gICAgICBjb25zdCBpbmRleCA9IF8uZmluZEluZGV4KHByZXYsIHsgcGF0aDogY29tTmFtZSB9KTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0aW9ucy5wdXNoKHByZXYuc3BsaWNlKGluZGV4LCAxKVswXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmFkZEhhbmRsZXIocG9ydCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcHJldi5mb3JFYWNoKGNvbm5lY3Rpb24gPT4gdGhpcy5jbG9zZUNvbm5lY3Rpb24oY29ubmVjdGlvbikpO1xuICB9O1xuXG4gIHByaXZhdGUgYWRkSGFuZGxlciA9ICh7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSwgZGVzY3JpcHRpb24gfTogSVBvcnRBcmcpID0+IHtcbiAgICBkZWJ1ZygnYWRkJyk7XG4gICAgY29uc3QgY29ubmVjdGlvbiA9IG5ldyBOaWJ1c0Nvbm5lY3Rpb24oY29tTmFtZSwgZGVzY3JpcHRpb24pO1xuICAgIHRoaXMuY29ubmVjdGlvbnMucHVzaChjb25uZWN0aW9uKTtcbiAgICB0aGlzLmVtaXQoJ2FkZCcsIGNvbm5lY3Rpb24pO1xuICAgIHRoaXMuZmluZChjb25uZWN0aW9uKTtcbiAgICBkZXZpY2VzLmdldCgpXG4gICAgICAuZmlsdGVyKGRldmljZSA9PiBkZXZpY2UuY29ubmVjdGlvbiA9PSBudWxsKVxuICAgICAgLnJlZHVjZShhc3luYyAocHJvbWlzZSwgZGV2aWNlKSA9PiB7XG4gICAgICAgIGF3YWl0IHByb21pc2U7XG4gICAgICAgIGRlYnVnKCdzdGFydCBwaW5nJyk7XG4gICAgICAgIGNvbnN0IHRpbWUgPSBhd2FpdCBjb25uZWN0aW9uLnBpbmcoZGV2aWNlLmFkZHJlc3MpO1xuICAgICAgICBkZWJ1ZyhgcGluZyAke3RpbWV9YCk7XG4gICAgICAgIGlmICh0aW1lICE9PSAtMSkge1xuICAgICAgICAgIGRldmljZS5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBOZXcgY29ubmVjdGVkIGRldmljZVxuICAgICAgICAgICAqIEBldmVudCBOaWJ1c1Nlc3Npb24jY29ubmVjdGVkXG4gICAgICAgICAgICogQHR5cGUgSURldmljZVxuICAgICAgICAgICAqL1xuICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgICAgICAvLyBkZXZpY2UuZW1pdCgnY29ubmVjdGVkJyk7XG4gICAgICAgICAgZGVidWcoYG1pYi1kZXZpY2UgJHtkZXZpY2UuYWRkcmVzc30gd2FzIGNvbm5lY3RlZGApO1xuICAgICAgICB9XG4gICAgICB9LCBQcm9taXNlLnJlc29sdmUoKSlcbiAgICAgIC5jYXRjaChub29wKTtcbiAgfTtcblxuICBwcml2YXRlIGNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pIHtcbiAgICBjb25uZWN0aW9uLmNsb3NlKCk7XG4gICAgZGV2aWNlcy5nZXQoKVxuICAgICAgLmZpbHRlcihkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24gPT09IGNvbm5lY3Rpb24pXG4gICAgICAuZm9yRWFjaCgoZGV2aWNlKSA9PiB7XG4gICAgICAgIGRldmljZS5jb25uZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAgIGRlYnVnKGBtaWItZGV2aWNlICR7ZGV2aWNlLmFkZHJlc3N9IHdhcyBkaXNjb25uZWN0ZWRgKTtcbiAgICAgIH0pO1xuICAgIHRoaXMuZW1pdCgncmVtb3ZlJywgY29ubmVjdGlvbik7XG4gIH1cblxuICBwcml2YXRlIHJlbW92ZUhhbmRsZXIgPSAoeyBwb3J0SW5mbzogeyBjb21OYW1lIH0gfTogSVBvcnRBcmcpID0+IHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuY29ubmVjdGlvbnMuZmluZEluZGV4KCh7IHBhdGggfSkgPT4gY29tTmFtZSA9PT0gcGF0aCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3QgW2Nvbm5lY3Rpb25dID0gdGhpcy5jb25uZWN0aW9ucy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgdGhpcy5jbG9zZUNvbm5lY3Rpb24oY29ubmVjdGlvbik7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgZmluZChjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pIHtcbiAgICBjb25zdCB7IGRlc2NyaXB0aW9uIH0gPSBjb25uZWN0aW9uO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9ucyA9IEFycmF5LmlzQXJyYXkoZGVzY3JpcHRpb24uc2VsZWN0KSA/IGRlc2NyaXB0aW9uLnNlbGVjdCA6IFtkZXNjcmlwdGlvbl07XG4gICAgZGVzY3JpcHRpb25zLmZvckVhY2goKGRlc2NyaXB0aW9uKSA9PiB7XG4gICAgICBjb25zdCB7IGNhdGVnb3J5IH0gPSBkZXNjcmlwdGlvbjtcbiAgICAgIHN3aXRjaCAoZGVzY3JpcHRpb24uZmluZCkge1xuICAgICAgICBjYXNlICdzYXJwJzoge1xuICAgICAgICAgIGxldCB7IHR5cGUgfSA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgIGlmICh0eXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pYiA9IHJlcXVpcmUoZ2V0TWliRmlsZShkZXNjcmlwdGlvbi5taWIhKSk7XG4gICAgICAgICAgICBjb25zdCB7IHR5cGVzIH0gPSBtaWI7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgICAgICAgICAgIHR5cGUgPSB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbm5lY3Rpb24ub25jZSgnc2FycCcsIChzYXJwRGF0YWdyYW06IFNhcnBEYXRhZ3JhbSkgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbm5lY3Rpb24uZGVzY3JpcHRpb24uY2F0ZWdvcnkgPT09ICdmdGRpJykge1xuICAgICAgICAgICAgICBkZWJ1ZyhgY2F0ZWdvcnkgd2FzIGNoYW5nZWQ6ICR7Y29ubmVjdGlvbi5kZXNjcmlwdGlvbi5jYXRlZ29yeX0gPT4gJHtjYXRlZ29yeX1gKTtcbiAgICAgICAgICAgICAgY29ubmVjdGlvbi5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9IG5ldyBBZGRyZXNzKHNhcnBEYXRhZ3JhbS5tYWMpO1xuICAgICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoXG4gICAgICAgICAgICAgICdmb3VuZCcsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbm5lY3Rpb24uZmluZEJ5VHlwZSh0eXBlKS5jYXRjaChub29wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlICd2ZXJzaW9uJzpcbiAgICAgICAgICBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShjcmVhdGVObXNSZWFkKEFkZHJlc3MuZW1wdHksIDIpKVxuICAgICAgICAgICAgLnRoZW4oKGRhdGFncmFtKSA9PiB7XG4gICAgICAgICAgICAgIGlmICghZGF0YWdyYW0gfHwgQXJyYXkuaXNBcnJheShkYXRhZ3JhbSkpIHJldHVybjtcbiAgICAgICAgICAgICAgaWYgKGNvbm5lY3Rpb24uZGVzY3JpcHRpb24uY2F0ZWdvcnkgPT09ICdmdGRpJykge1xuICAgICAgICAgICAgICAgIGRlYnVnKGBjYXRlZ29yeSB3YXMgY2hhbmdlZDogJHtjb25uZWN0aW9uLmRlc2NyaXB0aW9uLmNhdGVnb3J5fSA9PiAke2NhdGVnb3J5fWApO1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb24uZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBhZGRyZXNzID0gbmV3IEFkZHJlc3MoZGF0YWdyYW0uc291cmNlLm1hYyk7XG4gICAgICAgICAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgICAgICAgICAnZm91bmQnLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGNvbm5lY3Rpb24sXG4gICAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgICB9LCBub29wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIHB1YmxpYyBhc3luYyBzdGFydCh3YXRjaCA9IHRydWUpIHtcbiAgLy8gICBpZiAodGhpcy5pc1N0YXJ0ZWQpIHJldHVybjtcbiAgLy8gICBjb25zdCB7IGRldGVjdGlvbiB9ID0gZGV0ZWN0b3I7XG4gIC8vICAgaWYgKGRldGVjdGlvbiA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoJ2RldGVjdGlvbiBpcyBOL0EnKTtcbiAgLy8gICBkZXRlY3Rvci5vbignYWRkJywgdGhpcy5hZGRIYW5kbGVyKTtcbiAgLy8gICBkZXRlY3Rvci5vbigncmVtb3ZlJywgdGhpcy5yZW1vdmVIYW5kbGVyKTtcbiAgLy8gICBhd2FpdCBkZXRlY3Rvci5nZXRQb3J0cygpO1xuICAvL1xuICAvLyAgIGlmICh3YXRjaCkgZGV0ZWN0b3Iuc3RhcnQoKTtcbiAgLy8gICB0aGlzLmlzU3RhcnRlZCA9IHRydWU7XG4gIC8vICAgcHJvY2Vzcy5vbmNlKCdTSUdJTlQnLCAoKSA9PiB0aGlzLnN0b3AoKSk7XG4gIC8vICAgcHJvY2Vzcy5vbmNlKCdTSUdURVJNJywgKCkgPT4gdGhpcy5zdG9wKCkpO1xuICAvLyAgIC8qKlxuICAvLyAgICAqIEBldmVudCBOaWJ1c1NlcnZpY2Ujc3RhcnRcbiAgLy8gICAgKi9cbiAgLy8gICB0aGlzLmVtaXQoJ3N0YXJ0Jyk7XG4gIC8vICAgZGVidWcoJ3N0YXJ0ZWQnKTtcbiAgLy8gfVxuICAvL1xuICBzdGFydCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPigocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNTdGFydGVkKSByZXR1cm4gcmVzb2x2ZSh0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCk7XG4gICAgICB0aGlzLmlzU3RhcnRlZCA9IHRydWU7XG4gICAgICB0aGlzLnNvY2tldCA9IENsaWVudC5jb25uZWN0KFBBVEgpO1xuICAgICAgdGhpcy5zb2NrZXQub25jZSgnZXJyb3InLCAoZXJyb3IpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3Igd2hpbGUgc3RhcnQgbmlidXMuc2VydmljZScsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdwb3J0cycsIHRoaXMucmVsb2FkSGFuZGxlcik7XG4gICAgICB0aGlzLnNvY2tldC5vbignYWRkJywgdGhpcy5hZGRIYW5kbGVyKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUhhbmRsZXIpO1xuICAgICAgdGhpcy5zb2NrZXQub25jZSgncG9ydHMnLCAocG9ydHMpID0+IHtcbiAgICAgICAgcmVzb2x2ZShwb3J0cy5sZW5ndGgpO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXJ0Jyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpmdW5jdGlvbi1uYW1lXG4gIF9jb25uZWN0RGV2aWNlKGRldmljZTogSURldmljZSwgY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgaWYgKGRldmljZS5jb25uZWN0aW9uID09PSBjb25uZWN0aW9uKSByZXR1cm47XG4gICAgZGV2aWNlLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICAgIGNvbnN0IGV2ZW50ID0gY29ubmVjdGlvbiA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCc7XG4gICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoZXZlbnQsIGRldmljZSkpO1xuICAgIC8vIGRldmljZS5lbWl0KCdjb25uZWN0ZWQnKTtcbiAgICBkZWJ1ZyhgbWliLWRldmljZSBbJHtkZXZpY2UuYWRkcmVzc31dIHdhcyAke2V2ZW50fWApO1xuICB9XG5cbiAgcHVibGljIGNsb3NlKCkge1xuICAgIGlmICghdGhpcy5pc1N0YXJ0ZWQpIHJldHVybjtcbiAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdjbG9zZScpO1xuICAgIC8qKlxuICAgICAqIEBldmVudCBOaWJ1c1Nlc3Npb24jY2xvc2VcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG4gICAgLy8gZGV0ZWN0b3Iuc3RvcCgpO1xuICAgIHRoaXMuY29ubmVjdGlvbnNcbiAgICAgIC5zcGxpY2UoMCwgdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpXG4gICAgICAuZm9yRWFjaChjb25uZWN0aW9uID0+IHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pKTtcbiAgICB0aGlzLnNvY2tldCAmJiB0aGlzLnNvY2tldC5kZXN0cm95KCk7XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIC8vXG4gIGFzeW5jIHBpbmdEZXZpY2UoZGV2aWNlOiBJRGV2aWNlKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb25zIH0gPSB0aGlzO1xuICAgIGlmIChkZXZpY2UuY29ubmVjdGlvbiAmJiBjb25uZWN0aW9ucy5pbmNsdWRlcyhkZXZpY2UuY29ubmVjdGlvbikpIHtcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBhd2FpdCBkZXZpY2UuY29ubmVjdGlvbi5waW5nKGRldmljZS5hZGRyZXNzKTtcbiAgICAgIGlmICh0aW1lb3V0ICE9PSAtMSkgcmV0dXJuIHRpbWVvdXQ7XG4gICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgIC8vIGRldmljZS5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBtaWIgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpO1xuICAgIGNvbnN0IG9jY3VwaWVkID0gZGV2aWNlcy5nZXQoKVxuICAgICAgLm1hcChkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24hKVxuICAgICAgLmZpbHRlcihjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24gIT0gbnVsbCAmJiAhY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5saW5rKTtcbiAgICBjb25zdCBhY2NlcHRhYmxlcyA9IF8uZGlmZmVyZW5jZShjb25uZWN0aW9ucywgb2NjdXBpZWQpXG4gICAgICAuZmlsdGVyKCh7IGRlc2NyaXB0aW9uIH0pID0+IGRlc2NyaXB0aW9uLmxpbmsgfHwgZGVzY3JpcHRpb24ubWliID09PSBtaWIpO1xuICAgIGlmIChhY2NlcHRhYmxlcy5sZW5ndGggPT09IDApIHJldHVybiAtMTtcblxuICAgIGNvbnN0IFt0aW1lb3V0LCBjb25uZWN0aW9uXSA9IGF3YWl0IFByb21pc2UucmFjZShhY2NlcHRhYmxlcy5tYXAoXG4gICAgICBjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcylcbiAgICAgICAgLnRoZW4odCA9PiBbdCwgY29ubmVjdGlvbl0gYXMgW251bWJlciwgTmlidXNDb25uZWN0aW9uXSkpKTtcbiAgICBpZiAodGltZW91dCA9PT0gLTEpIHtcbiAgICAgIC8vIHBpbmcoYWNjZXB0YWJsZXNbMF0sIGRldmljZS5hZGRyZXNzKTtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICB0aGlzLl9jb25uZWN0RGV2aWNlKGRldmljZSwgY29ubmVjdGlvbik7XG4gICAgcmV0dXJuIHRpbWVvdXQ7XG4gIH1cblxuICBhc3luYyBwaW5nKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9ucyB9ID0gdGhpcztcbiAgICBjb25zdCBhZGRyID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgtMSk7XG4gICAgcmV0dXJuIFByb21pc2UucmFjZShjb25uZWN0aW9ucy5tYXAoY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uLnBpbmcoYWRkcikpKTtcbiAgfVxuXG4gIGdldCBwb3J0cygpIHtcbiAgICByZXR1cm4gdGhpcy5jb25uZWN0aW9ucy5sZW5ndGg7XG4gIH1cbn1cblxuY29uc3Qgc2Vzc2lvbiA9IG5ldyBOaWJ1c1Nlc3Npb24oKTtcblxuZGV2aWNlcy5vbignbmV3JywgKGRldmljZTogSURldmljZSkgPT4ge1xuICBpZiAoIWRldmljZS5jb25uZWN0aW9uKSB7XG4gICAgc2Vzc2lvbi5waW5nRGV2aWNlKGRldmljZSkuY2F0Y2gobm9vcCk7XG4gIH1cbn0pO1xuXG5kZXZpY2VzLm9uKCdkZWxldGUnLCAoZGV2aWNlOiBJRGV2aWNlKSA9PiB7XG4gIGlmIChkZXZpY2UuY29ubmVjdGlvbikge1xuICAgIGRldmljZS5jb25uZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgIHNlc3Npb24uZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAvLyBkZXZpY2UuZW1pdCgnZGlzY29ubmVjdGVkJyk7XG4gIH1cbn0pO1xuXG5zZXNzaW9uLm9uKCdmb3VuZCcsICh7IGFkZHJlc3MsIGNvbm5lY3Rpb24gfSkgPT4ge1xuICBjb25zb2xlLmFzc2VydChhZGRyZXNzLnR5cGUgPT09IEFkZHJlc3NUeXBlLm1hYywgJ21hYy1hZGRyZXNzIGV4cGVjdGVkJyk7XG4gIGNvbnN0IGRldmljZSA9IGRldmljZXMuZmluZChhZGRyZXNzKTtcbiAgaWYgKGRldmljZSkge1xuICAgIHNlc3Npb24uX2Nvbm5lY3REZXZpY2UoZGV2aWNlLCBjb25uZWN0aW9uKTtcbiAgfVxufSk7XG5cbnByb2Nlc3Mub24oJ1NJR0lOVCcsICgpID0+IHNlc3Npb24uY2xvc2UoKSk7XG5wcm9jZXNzLm9uKCdTSUdURVJNJywgKCkgPT4gc2Vzc2lvbi5jbG9zZSgpKTtcblxuZXhwb3J0IGRlZmF1bHQgc2Vzc2lvbjtcbiJdfQ==