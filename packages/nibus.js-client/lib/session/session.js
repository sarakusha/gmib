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
              const mib = JSON.parse(_fs.default.readFileSync((0, _devices.getMibFile)(description.mib)).toString());
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL3Nlc3Npb24udHMiXSwibmFtZXMiOlsiZGVidWciLCJub29wIiwiZGVsYXkiLCJzZWNvbmRzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwiTmlidXNTZXNzaW9uIiwiRXZlbnRFbWl0dGVyIiwicG9ydHMiLCJwcmV2IiwiY29ubmVjdGlvbnMiLCJzcGxpY2UiLCJsZW5ndGgiLCJmb3JFYWNoIiwicG9ydCIsInBvcnRJbmZvIiwiY29tTmFtZSIsImluZGV4IiwiXyIsImZpbmRJbmRleCIsInBhdGgiLCJwdXNoIiwiYWRkSGFuZGxlciIsImNvbm5lY3Rpb24iLCJjbG9zZUNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiIsIk5pYnVzQ29ubmVjdGlvbiIsImVtaXQiLCJwcm9jZXNzIiwicGxhdGZvcm0iLCJmaW5kIiwiZGV2aWNlcyIsImdldCIsImZpbHRlciIsImRldmljZSIsInJlZHVjZSIsInByb21pc2UiLCJ0aW1lIiwicGluZyIsImFkZHJlc3MiLCJjYXRjaCIsImNsb3NlIiwidW5kZWZpbmVkIiwiZGVzY3JpcHRpb25zIiwiQXJyYXkiLCJpc0FycmF5Iiwic2VsZWN0IiwiY2F0ZWdvcnkiLCJ0eXBlIiwibWliIiwiSlNPTiIsInBhcnNlIiwiZnMiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsInR5cGVzIiwiYXBwaW5mbyIsImRldmljZV90eXBlIiwib25jZSIsInNhcnBEYXRhZ3JhbSIsIkFkZHJlc3MiLCJtYWMiLCJmaW5kQnlUeXBlIiwic2VuZERhdGFncmFtIiwiZW1wdHkiLCJ0aGVuIiwiZGF0YWdyYW0iLCJzb3VyY2UiLCJzdGFydCIsInJlamVjdCIsImlzU3RhcnRlZCIsInNvY2tldCIsIkNsaWVudCIsImNvbm5lY3QiLCJQQVRIIiwiZXJyb3IiLCJjb25zb2xlIiwibWVzc2FnZSIsIm9uIiwicmVsb2FkSGFuZGxlciIsInJlbW92ZUhhbmRsZXIiLCJfY29ubmVjdERldmljZSIsImV2ZW50IiwibmV4dFRpY2siLCJkZXN0cm95IiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwicGluZ0RldmljZSIsImluY2x1ZGVzIiwidGltZW91dCIsIlJlZmxlY3QiLCJnZXRNZXRhZGF0YSIsIm9jY3VwaWVkIiwibWFwIiwibGluayIsImFjY2VwdGFibGVzIiwiZGlmZmVyZW5jZSIsInJhY2UiLCJ0IiwiYWRkciIsInNlc3Npb24iLCJhc3NlcnQiLCJBZGRyZXNzVHlwZSIsImRldnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOzs7Ozs7OztBQUdBLE1BQU1BLEtBQUssR0FBRyxvQkFBYSxlQUFiLENBQWQ7O0FBQ0EsTUFBTUMsSUFBSSxHQUFHLE1BQU0sQ0FBRSxDQUFyQjs7QUFDTyxNQUFNQyxLQUFLLEdBQUlDLE9BQUQsSUFDbkIsSUFBSUMsT0FBSixDQUFZQyxPQUFPLElBQUlDLFVBQVUsQ0FBQ0QsT0FBRCxFQUFVRixPQUFPLEdBQUcsSUFBcEIsQ0FBakMsQ0FESzs7OztBQTRCUCxNQUFNSSxZQUFOLFNBQTJCQyxvQkFBM0IsQ0FBd0M7QUFBQTtBQUFBOztBQUFBLHlDQUNZLEVBRFo7O0FBQUEsdUNBRWxCLEtBRmtCOztBQUFBOztBQUFBLDJDQUtiQyxLQUFELElBQXVCO0FBQzdDLFlBQU1DLElBQUksR0FBRyxLQUFLQyxXQUFMLENBQWlCQyxNQUFqQixDQUF3QixDQUF4QixFQUEyQixLQUFLRCxXQUFMLENBQWlCRSxNQUE1QyxDQUFiO0FBQ0FKLE1BQUFBLEtBQUssQ0FBQ0ssT0FBTixDQUFlQyxJQUFELElBQVU7QUFDdEIsY0FBTTtBQUFFQyxVQUFBQSxRQUFRLEVBQUU7QUFBRUMsWUFBQUE7QUFBRjtBQUFaLFlBQTRCRixJQUFsQzs7QUFDQSxjQUFNRyxLQUFLLEdBQUdDLGdCQUFFQyxTQUFGLENBQVlWLElBQVosRUFBa0I7QUFBRVcsVUFBQUEsSUFBSSxFQUFFSjtBQUFSLFNBQWxCLENBQWQ7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UixFQUEzQjtBQUNBYixPQUFPLENBQUNrRCxFQUFSLENBQVcsU0FBWCxFQUFzQixNQUFNcUIsT0FBTyxDQUFDMUQsS0FBUixFQUE1QjtlQUVlMEQsTyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuaW1wb3J0IGRlYnVnRmFjdG9yeSBmcm9tICdkZWJ1Zyc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IFNvY2tldCB9IGZyb20gJ25ldCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IEFkZHJlc3MsIHsgQWRkcmVzc1BhcmFtLCBBZGRyZXNzVHlwZSB9IGZyb20gJy4uL0FkZHJlc3MnO1xuaW1wb3J0IHsgQ2xpZW50LCBJUG9ydEFyZyB9IGZyb20gJy4uL2lwYyc7XG5pbXBvcnQgeyBkZXZpY2VzLCBJRGV2aWNlLCB0b0ludCB9IGZyb20gJy4uL21pYic7XG5pbXBvcnQgeyBnZXRNaWJGaWxlLCBJTWliRGV2aWNlVHlwZSB9IGZyb20gJy4uL21pYi9kZXZpY2VzJztcbmltcG9ydCB7IE5pYnVzQ29ubmVjdGlvbiB9IGZyb20gJy4uL25pYnVzJztcbmltcG9ydCB7IGNyZWF0ZU5tc1JlYWQgfSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IFNhcnBEYXRhZ3JhbSBmcm9tICcuLi9zYXJwL1NhcnBEYXRhZ3JhbSc7XG5pbXBvcnQgeyBQQVRIIH0gZnJvbSAnLi9jb21tb24nO1xuaW1wb3J0IHsgQ2F0ZWdvcnkgfSBmcm9tICcuL0tub3duUG9ydHMnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmlidXM6c2Vzc2lvbicpO1xuY29uc3Qgbm9vcCA9ICgpID0+IHt9O1xuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKHNlY29uZHM6IG51bWJlcikgPT5cbiAgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHNlY29uZHMgKiAxMDAwKSk7XG5cbmV4cG9ydCB0eXBlIEZvdW5kTGlzdGVuZXIgPVxuICAoYXJnOiB7IGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbiwgY2F0ZWdvcnk6IENhdGVnb3J5LCBhZGRyZXNzOiBBZGRyZXNzIH0pID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIENvbm5lY3Rpb25MaXN0ZW5lciA9IChjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBEZXZpY2VMaXN0ZW5lciA9IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQ7XG5cbmRlY2xhcmUgaW50ZXJmYWNlIE5pYnVzU2Vzc2lvbiB7XG4gIG9uKGV2ZW50OiAnc3RhcnQnIHwgJ2Nsb3NlJywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcztcbiAgb24oZXZlbnQ6ICdmb3VuZCcsIGxpc3RlbmVyOiBGb3VuZExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6IERldmljZUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdmb3VuZCcsIGxpc3RlbmVyOiBGb3VuZExpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2FkZCcgfCAncmVtb3ZlJywgbGlzdGVuZXI6IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3N0YXJ0JyB8ICdjbG9zZScsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXM7XG4gIG9mZihldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiBEZXZpY2VMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnc3RhcnQnIHwgJ2Nsb3NlJywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdmb3VuZCcsIGxpc3RlbmVyOiBGb3VuZExpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdhZGQnIHwgJ3JlbW92ZScsIGxpc3RlbmVyOiBDb25uZWN0aW9uTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6IERldmljZUxpc3RlbmVyKTogdGhpcztcbn1cblxuY2xhc3MgTmlidXNTZXNzaW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBjb25uZWN0aW9uczogTmlidXNDb25uZWN0aW9uW10gPSBbXTtcbiAgcHJpdmF0ZSBpc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzb2NrZXQ/OiBTb2NrZXQ7IC8vID0gQ2xpZW50LmNvbm5lY3QoUEFUSCk7XG5cbiAgcHJpdmF0ZSByZWxvYWRIYW5kbGVyID0gKHBvcnRzOiBJUG9ydEFyZ1tdKSA9PiB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuY29ubmVjdGlvbnMuc3BsaWNlKDAsIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKTtcbiAgICBwb3J0cy5mb3JFYWNoKChwb3J0KSA9PiB7XG4gICAgICBjb25zdCB7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSB9ID0gcG9ydDtcbiAgICAgIGNvbnN0IGluZGV4ID0gXy5maW5kSW5kZXgocHJldiwgeyBwYXRoOiBjb21OYW1lIH0pO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zLnB1c2gocHJldi5zcGxpY2UoaW5kZXgsIDEpWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWRkSGFuZGxlcihwb3J0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBwcmV2LmZvckVhY2goY29ubmVjdGlvbiA9PiB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBhZGRIYW5kbGVyID0gYXN5bmMgKHsgcG9ydEluZm86IHsgY29tTmFtZSB9LCBkZXNjcmlwdGlvbiB9OiBJUG9ydEFyZykgPT4ge1xuICAgIGRlYnVnKCdhZGQnKTtcbiAgICBjb25zdCBjb25uZWN0aW9uID0gbmV3IE5pYnVzQ29ubmVjdGlvbihjb21OYW1lLCBkZXNjcmlwdGlvbik7XG4gICAgdGhpcy5jb25uZWN0aW9ucy5wdXNoKGNvbm5lY3Rpb24pO1xuICAgIHRoaXMuZW1pdCgnYWRkJywgY29ubmVjdGlvbik7XG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIGF3YWl0IGRlbGF5KDIpO1xuICAgIHRoaXMuZmluZChjb25uZWN0aW9uKTtcbiAgICBkZXZpY2VzLmdldCgpXG4gICAgICAuZmlsdGVyKGRldmljZSA9PiBkZXZpY2UuY29ubmVjdGlvbiA9PSBudWxsKVxuICAgICAgLnJlZHVjZShhc3luYyAocHJvbWlzZSwgZGV2aWNlKSA9PiB7XG4gICAgICAgIGF3YWl0IHByb21pc2U7XG4gICAgICAgIGRlYnVnKCdzdGFydCBwaW5nJyk7XG4gICAgICAgIGNvbnN0IHRpbWUgPSBhd2FpdCBjb25uZWN0aW9uLnBpbmcoZGV2aWNlLmFkZHJlc3MpO1xuICAgICAgICBkZWJ1ZyhgcGluZyAke3RpbWV9YCk7XG4gICAgICAgIGlmICh0aW1lICE9PSAtMSkge1xuICAgICAgICAgIGRldmljZS5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBOZXcgY29ubmVjdGVkIGRldmljZVxuICAgICAgICAgICAqIEBldmVudCBOaWJ1c1Nlc3Npb24jY29ubmVjdGVkXG4gICAgICAgICAgICogQHR5cGUgSURldmljZVxuICAgICAgICAgICAqL1xuICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgICAgICAvLyBkZXZpY2UuZW1pdCgnY29ubmVjdGVkJyk7XG4gICAgICAgICAgZGVidWcoYG1pYi1kZXZpY2UgJHtkZXZpY2UuYWRkcmVzc30gd2FzIGNvbm5lY3RlZGApO1xuICAgICAgICB9XG4gICAgICB9LCBQcm9taXNlLnJlc29sdmUoKSlcbiAgICAgIC5jYXRjaChub29wKTtcbiAgfTtcblxuICBwcml2YXRlIGNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pIHtcbiAgICBjb25uZWN0aW9uLmNsb3NlKCk7XG4gICAgZGV2aWNlcy5nZXQoKVxuICAgICAgLmZpbHRlcihkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24gPT09IGNvbm5lY3Rpb24pXG4gICAgICAuZm9yRWFjaCgoZGV2aWNlKSA9PiB7XG4gICAgICAgIGRldmljZS5jb25uZWN0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAgIGRlYnVnKGBtaWItZGV2aWNlICR7Y29ubmVjdGlvbi5wYXRofSMke2RldmljZS5hZGRyZXNzfSB3YXMgZGlzY29ubmVjdGVkYCk7XG4gICAgICB9KTtcbiAgICB0aGlzLmVtaXQoJ3JlbW92ZScsIGNvbm5lY3Rpb24pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVIYW5kbGVyID0gKHsgcG9ydEluZm86IHsgY29tTmFtZSB9IH06IElQb3J0QXJnKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmNvbm5lY3Rpb25zLmZpbmRJbmRleCgoeyBwYXRoIH0pID0+IGNvbU5hbWUgPT09IHBhdGgpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IFtjb25uZWN0aW9uXSA9IHRoaXMuY29ubmVjdGlvbnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGZpbmQoY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgY29uc3QgeyBkZXNjcmlwdGlvbiB9ID0gY29ubmVjdGlvbjtcbiAgICBjb25zdCBkZXNjcmlwdGlvbnMgPSBBcnJheS5pc0FycmF5KGRlc2NyaXB0aW9uLnNlbGVjdCkgPyBkZXNjcmlwdGlvbi5zZWxlY3QgOiBbZGVzY3JpcHRpb25dO1xuICAgIGRlc2NyaXB0aW9ucy5mb3JFYWNoKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgY29uc3QgeyBjYXRlZ29yeSB9ID0gZGVzY3JpcHRpb247XG4gICAgICBzd2l0Y2ggKGRlc2NyaXB0aW9uLmZpbmQpIHtcbiAgICAgICAgY2FzZSAnc2FycCc6IHtcbiAgICAgICAgICBsZXQgeyB0eXBlIH0gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgICBpZiAodHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCBtaWIgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhnZXRNaWJGaWxlKGRlc2NyaXB0aW9uLm1pYiEpKS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIGNvbnN0IHsgdHlwZXMgfSA9IG1pYjtcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHR5cGVzW21pYi5kZXZpY2VdIGFzIElNaWJEZXZpY2VUeXBlO1xuICAgICAgICAgICAgdHlwZSA9IHRvSW50KGRldmljZS5hcHBpbmZvLmRldmljZV90eXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29ubmVjdGlvbi5vbmNlKCdzYXJwJywgKHNhcnBEYXRhZ3JhbTogU2FycERhdGFncmFtKSA9PiB7XG4gICAgICAgICAgICBpZiAoY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5jYXRlZ29yeSA9PT0gJ2Z0ZGknKSB7XG4gICAgICAgICAgICAgIGRlYnVnKGBjYXRlZ29yeSB3YXMgY2hhbmdlZDogJHtjb25uZWN0aW9uLmRlc2NyaXB0aW9uLmNhdGVnb3J5fSA9PiAke2NhdGVnb3J5fWApO1xuICAgICAgICAgICAgICBjb25uZWN0aW9uLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhZGRyZXNzID0gbmV3IEFkZHJlc3Moc2FycERhdGFncmFtLm1hYyk7XG4gICAgICAgICAgICBkZWJ1ZyhgZGV2aWNlICR7Y2F0ZWdvcnl9WyR7YWRkcmVzc31dIHdhcyBmb3VuZCBvbiAke2Nvbm5lY3Rpb24ucGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgICAgICAgJ2ZvdW5kJyxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb24sXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnksXG4gICAgICAgICAgICAgICAgYWRkcmVzcyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29ubmVjdGlvbi5maW5kQnlUeXBlKHR5cGUpLmNhdGNoKG5vb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgJ3ZlcnNpb24nOlxuICAgICAgICAgIGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGNyZWF0ZU5tc1JlYWQoQWRkcmVzcy5lbXB0eSwgMikpXG4gICAgICAgICAgICAudGhlbigoZGF0YWdyYW0pID0+IHtcbiAgICAgICAgICAgICAgaWYgKCFkYXRhZ3JhbSB8fCBBcnJheS5pc0FycmF5KGRhdGFncmFtKSkgcmV0dXJuO1xuICAgICAgICAgICAgICBpZiAoY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5jYXRlZ29yeSA9PT0gJ2Z0ZGknKSB7XG4gICAgICAgICAgICAgICAgZGVidWcoYGNhdGVnb3J5IHdhcyBjaGFuZ2VkOiAke2Nvbm5lY3Rpb24uZGVzY3JpcHRpb24uY2F0ZWdvcnl9ID0+ICR7Y2F0ZWdvcnl9YCk7XG4gICAgICAgICAgICAgICAgY29ubmVjdGlvbi5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGFkZHJlc3MgPSBuZXcgQWRkcmVzcyhkYXRhZ3JhbS5zb3VyY2UubWFjKTtcbiAgICAgICAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICAgICAgICdmb3VuZCcsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgY29ubmVjdGlvbixcbiAgICAgICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgICAgYWRkcmVzcyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBkZWJ1ZyhgZGV2aWNlICR7Y2F0ZWdvcnl9WyR7YWRkcmVzc31dIHdhcyBmb3VuZCBvbiAke2Nvbm5lY3Rpb24ucGF0aH1gKTtcbiAgICAgICAgICAgIH0sIG5vb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gcHVibGljIGFzeW5jIHN0YXJ0KHdhdGNoID0gdHJ1ZSkge1xuICAvLyAgIGlmICh0aGlzLmlzU3RhcnRlZCkgcmV0dXJuO1xuICAvLyAgIGNvbnN0IHsgZGV0ZWN0aW9uIH0gPSBkZXRlY3RvcjtcbiAgLy8gICBpZiAoZGV0ZWN0aW9uID09IG51bGwpIHRocm93IG5ldyBFcnJvcignZGV0ZWN0aW9uIGlzIE4vQScpO1xuICAvLyAgIGRldGVjdG9yLm9uKCdhZGQnLCB0aGlzLmFkZEhhbmRsZXIpO1xuICAvLyAgIGRldGVjdG9yLm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUhhbmRsZXIpO1xuICAvLyAgIGF3YWl0IGRldGVjdG9yLmdldFBvcnRzKCk7XG4gIC8vXG4gIC8vICAgaWYgKHdhdGNoKSBkZXRlY3Rvci5zdGFydCgpO1xuICAvLyAgIHRoaXMuaXNTdGFydGVkID0gdHJ1ZTtcbiAgLy8gICBwcm9jZXNzLm9uY2UoJ1NJR0lOVCcsICgpID0+IHRoaXMuc3RvcCgpKTtcbiAgLy8gICBwcm9jZXNzLm9uY2UoJ1NJR1RFUk0nLCAoKSA9PiB0aGlzLnN0b3AoKSk7XG4gIC8vICAgLyoqXG4gIC8vICAgICogQGV2ZW50IE5pYnVzU2VydmljZSNzdGFydFxuICAvLyAgICAqL1xuICAvLyAgIHRoaXMuZW1pdCgnc3RhcnQnKTtcbiAgLy8gICBkZWJ1Zygnc3RhcnRlZCcpO1xuICAvLyB9XG4gIC8vXG4gIHN0YXJ0KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzU3RhcnRlZCkgcmV0dXJuIHJlc29sdmUodGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpO1xuICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zb2NrZXQgPSBDbGllbnQuY29ubmVjdChQQVRIKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uY2UoJ2Vycm9yJywgKGVycm9yKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2Vycm9yIHdoaWxlIHN0YXJ0IG5pYnVzLnNlcnZpY2UnLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLnNvY2tldC5vbigncG9ydHMnLCB0aGlzLnJlbG9hZEhhbmRsZXIpO1xuICAgICAgdGhpcy5zb2NrZXQub24oJ2FkZCcsIHRoaXMuYWRkSGFuZGxlcik7XG4gICAgICB0aGlzLnNvY2tldC5vbigncmVtb3ZlJywgdGhpcy5yZW1vdmVIYW5kbGVyKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uY2UoJ3BvcnRzJywgKHBvcnRzKSA9PiB7XG4gICAgICAgIHJlc29sdmUocG9ydHMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5lbWl0KCdzdGFydCcpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6ZnVuY3Rpb24tbmFtZVxuICBfY29ubmVjdERldmljZShkZXZpY2U6IElEZXZpY2UsIGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikge1xuICAgIGlmIChkZXZpY2UuY29ubmVjdGlvbiA9PT0gY29ubmVjdGlvbikgcmV0dXJuO1xuICAgIGRldmljZS5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICBjb25zdCBldmVudCA9IGNvbm5lY3Rpb24gPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnO1xuICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KGV2ZW50LCBkZXZpY2UpKTtcbiAgICAvLyBkZXZpY2UuZW1pdCgnY29ubmVjdGVkJyk7XG4gICAgZGVidWcoYG1pYi1kZXZpY2UgWyR7ZGV2aWNlLmFkZHJlc3N9XSB3YXMgJHtldmVudH1gKTtcbiAgfVxuXG4gIHB1YmxpYyBjbG9zZSgpIHtcbiAgICBpZiAoIXRoaXMuaXNTdGFydGVkKSByZXR1cm47XG4gICAgdGhpcy5pc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICBkZWJ1ZygnY2xvc2UnKTtcbiAgICAvKipcbiAgICAgKiBAZXZlbnQgTmlidXNTZXNzaW9uI2Nsb3NlXG4gICAgICovXG4gICAgdGhpcy5lbWl0KCdjbG9zZScpO1xuICAgIC8vIGRldGVjdG9yLnN0b3AoKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zXG4gICAgICAuc3BsaWNlKDAsIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKVxuICAgICAgLmZvckVhY2goY29ubmVjdGlvbiA9PiB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKSk7XG4gICAgdGhpcy5zb2NrZXQgJiYgdGhpcy5zb2NrZXQuZGVzdHJveSgpO1xuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICAvL1xuICBhc3luYyBwaW5nRGV2aWNlKGRldmljZTogSURldmljZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9ucyB9ID0gdGhpcztcbiAgICBpZiAoZGV2aWNlLmNvbm5lY3Rpb24gJiYgY29ubmVjdGlvbnMuaW5jbHVkZXMoZGV2aWNlLmNvbm5lY3Rpb24pKSB7XG4gICAgICBjb25zdCB0aW1lb3V0ID0gYXdhaXQgZGV2aWNlLmNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcyk7XG4gICAgICBpZiAodGltZW91dCAhPT0gLTEpIHJldHVybiB0aW1lb3V0O1xuICAgICAgZGV2aWNlLmNvbm5lY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAvLyBkZXZpY2UuZW1pdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgfVxuXG4gICAgY29uc3QgbWliID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgZGV2aWNlKTtcbiAgICBjb25zdCBvY2N1cGllZCA9IGRldmljZXMuZ2V0KClcbiAgICAgIC5tYXAoZGV2aWNlID0+IGRldmljZS5jb25uZWN0aW9uISlcbiAgICAgIC5maWx0ZXIoY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uICE9IG51bGwgJiYgIWNvbm5lY3Rpb24uZGVzY3JpcHRpb24ubGluayk7XG4gICAgY29uc3QgYWNjZXB0YWJsZXMgPSBfLmRpZmZlcmVuY2UoY29ubmVjdGlvbnMsIG9jY3VwaWVkKVxuICAgICAgLmZpbHRlcigoeyBkZXNjcmlwdGlvbiB9KSA9PiBkZXNjcmlwdGlvbi5saW5rIHx8IGRlc2NyaXB0aW9uLm1pYiA9PT0gbWliKTtcbiAgICBpZiAoYWNjZXB0YWJsZXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTE7XG5cbiAgICBjb25zdCBbdGltZW91dCwgY29ubmVjdGlvbl0gPSBhd2FpdCBQcm9taXNlLnJhY2UoYWNjZXB0YWJsZXMubWFwKFxuICAgICAgY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uLnBpbmcoZGV2aWNlLmFkZHJlc3MpXG4gICAgICAgIC50aGVuKHQgPT4gW3QsIGNvbm5lY3Rpb25dIGFzIFtudW1iZXIsIE5pYnVzQ29ubmVjdGlvbl0pKSk7XG4gICAgaWYgKHRpbWVvdXQgPT09IC0xKSB7XG4gICAgICAvLyBwaW5nKGFjY2VwdGFibGVzWzBdLCBkZXZpY2UuYWRkcmVzcyk7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgdGhpcy5fY29ubmVjdERldmljZShkZXZpY2UsIGNvbm5lY3Rpb24pO1xuICAgIHJldHVybiB0aW1lb3V0O1xuICB9XG5cbiAgYXN5bmMgcGluZyhhZGRyZXNzOiBBZGRyZXNzUGFyYW0pOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbnMgfSA9IHRoaXM7XG4gICAgY29uc3QgYWRkciA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIGlmIChjb25uZWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiBQcm9taXNlLnJlc29sdmUoLTEpO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoY29ubmVjdGlvbnMubWFwKGNvbm5lY3Rpb24gPT4gY29ubmVjdGlvbi5waW5nKGFkZHIpKSk7XG4gIH1cblxuICBnZXQgcG9ydHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoO1xuICB9XG59XG5cbmNvbnN0IHNlc3Npb24gPSBuZXcgTmlidXNTZXNzaW9uKCk7XG5cbmRldmljZXMub24oJ25ldycsIChkZXZpY2U6IElEZXZpY2UpID0+IHtcbiAgaWYgKCFkZXZpY2UuY29ubmVjdGlvbikge1xuICAgIHNlc3Npb24ucGluZ0RldmljZShkZXZpY2UpLmNhdGNoKG5vb3ApO1xuICB9XG59KTtcblxuZGV2aWNlcy5vbignZGVsZXRlJywgKGRldmljZTogSURldmljZSkgPT4ge1xuICBpZiAoZGV2aWNlLmNvbm5lY3Rpb24pIHtcbiAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBzZXNzaW9uLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgLy8gZGV2aWNlLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcpO1xuICB9XG59KTtcblxuc2Vzc2lvbi5vbignZm91bmQnLCAoeyBhZGRyZXNzLCBjb25uZWN0aW9uIH0pID0+IHtcbiAgY29uc29sZS5hc3NlcnQoXG4gICAgYWRkcmVzcy50eXBlID09PSBBZGRyZXNzVHlwZS5tYWMgfHwgYWRkcmVzcy50eXBlID09PSAnZW1wdHknLFxuICAgICdtYWMtYWRkcmVzcyBleHBlY3RlZCcsXG4gICk7XG4gIGNvbnN0IGRldnMgPSBkZXZpY2VzLmZpbmQoYWRkcmVzcyk7XG4gIGlmIChkZXZzICYmIGRldnMubGVuZ3RoID09PSAxKSB7XG4gICAgc2Vzc2lvbi5fY29ubmVjdERldmljZShkZXZzWzBdLCBjb25uZWN0aW9uKTtcbiAgfVxufSk7XG5cbnByb2Nlc3Mub24oJ1NJR0lOVCcsICgpID0+IHNlc3Npb24uY2xvc2UoKSk7XG5wcm9jZXNzLm9uKCdTSUdURVJNJywgKCkgPT4gc2Vzc2lvbi5jbG9zZSgpKTtcblxuZXhwb3J0IGRlZmF1bHQgc2Vzc2lvbjtcbiJdfQ==