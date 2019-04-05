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
      if (this.isStarted) return resolve();
      this.socket = _ipc.Client.connect(_common.PATH);
      this.socket.on('ports', this.reloadHandler);
      this.socket.on('add', this.addHandler);
      this.socket.on('remove', this.removeHandler);
      this.isStarted = true;
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
  category,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL3Nlc3Npb24udHMiXSwibmFtZXMiOlsiZGVidWciLCJub29wIiwiTmlidXNTZXNzaW9uIiwiRXZlbnRFbWl0dGVyIiwicG9ydHMiLCJwcmV2IiwiY29ubmVjdGlvbnMiLCJzcGxpY2UiLCJsZW5ndGgiLCJmb3JFYWNoIiwicG9ydCIsInBvcnRJbmZvIiwiY29tTmFtZSIsImluZGV4IiwiXyIsImZpbmRJbmRleCIsInBhdGgiLCJwdXNoIiwiYWRkSGFuZGxlciIsImNvbm5lY3Rpb24iLCJjbG9zZUNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiIsIk5pYnVzQ29ubmVjdGlvbiIsImVtaXQiLCJmaW5kIiwiZGV2aWNlcyIsImdldCIsImZpbHRlciIsImRldmljZSIsInJlZHVjZSIsInByb21pc2UiLCJ0aW1lIiwicGluZyIsImFkZHJlc3MiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNhdGNoIiwiY2xvc2UiLCJ1bmRlZmluZWQiLCJjYXRlZ29yeSIsInR5cGUiLCJtaWIiLCJyZXF1aXJlIiwidHlwZXMiLCJhcHBpbmZvIiwiZGV2aWNlX3R5cGUiLCJvbmNlIiwic2FycERhdGFncmFtIiwiQWRkcmVzcyIsIm1hYyIsImZpbmRCeVR5cGUiLCJzZW5kRGF0YWdyYW0iLCJlbXB0eSIsInRoZW4iLCJkYXRhZ3JhbSIsIkFycmF5IiwiaXNBcnJheSIsInNvdXJjZSIsInN0YXJ0IiwiaXNTdGFydGVkIiwic29ja2V0IiwiQ2xpZW50IiwiY29ubmVjdCIsIlBBVEgiLCJvbiIsInJlbG9hZEhhbmRsZXIiLCJyZW1vdmVIYW5kbGVyIiwiX2Nvbm5lY3REZXZpY2UiLCJldmVudCIsInByb2Nlc3MiLCJuZXh0VGljayIsImRlc3Ryb3kiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJwaW5nRGV2aWNlIiwiaW5jbHVkZXMiLCJ0aW1lb3V0IiwiUmVmbGVjdCIsImdldE1ldGFkYXRhIiwib2NjdXBpZWQiLCJtYXAiLCJsaW5rIiwiYWNjZXB0YWJsZXMiLCJkaWZmZXJlbmNlIiwicmFjZSIsInQiLCJhZGRyIiwic2Vzc2lvbiIsImNvbnNvbGUiLCJhc3NlcnQiLCJBZGRyZXNzVHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7Ozs7Ozs7O0FBR0EsTUFBTUEsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDs7QUFDQSxNQUFNQyxJQUFJLEdBQUcsTUFBTSxDQUFFLENBQXJCOztBQW1CQSxNQUFNQyxZQUFOLFNBQTJCQyxvQkFBM0IsQ0FBd0M7QUFBQTtBQUFBOztBQUFBLHlDQUNZLEVBRFo7O0FBQUEsdUNBRWxCLEtBRmtCOztBQUFBOztBQUFBLDJDQUtiQyxLQUFELElBQXVCO0FBQzdDLFlBQU1DLElBQUksR0FBRyxLQUFLQyxXQUFMLENBQWlCQyxNQUFqQixDQUF3QixDQUF4QixFQUEyQixLQUFLRCxXQUFMLENBQWlCRSxNQUE1QyxDQUFiO0FBQ0FKLE1BQUFBLEtBQUssQ0FBQ0ssT0FBTixDQUFlQyxJQUFELElBQVU7QUFDdEIsY0FBTTtBQUFFQyxVQUFBQSxRQUFRLEVBQUU7QUFBRUMsWUFBQUE7QUFBRjtBQUFaLFlBQTRCRixJQUFsQzs7QUFDQSxjQUFNRyxLQUFLLEdBQUdDLGdCQUFFQyxTQUFGLENBQVlWLElBQVosRUFBa0I7QUFBRVcsVUFBQUEsSUFBSSxFQUFFSjtBQUFSLFNBQWxCLENBQWQ7O0FBQ0EsWUFBSUMsS0FBSyxLQUFLLENBQUMsQ0FBZixFQUFrQjtBQUNoQixlQUFLUCxXQUFMLENBQWlCVyxJQUFqQixDQUFzQlosSUFBSSxDQUFDRSxNQUFMLENBQVlNLEtBQVosRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsQ0FBdEI7QUFDRCxTQUZELE1BRU87QUFDTCxlQUFLSyxVQUFMLENBQWdCUixJQUFoQjtBQUNEO0FBQ0YsT0FSRDtBQVNBTCxNQUFBQSxJQUFJLENBQUNJLE9BQUwsQ0FBYVUsVUFBVSxJQUFJLEtBQUtDLGVBQUwsQ0FBcUJELFVB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LGNBQWIsRUFBNkJLLE1BQTdCLEVBRnFCLENBR3JCO0FBQ0Q7QUFDRixDQU5EOztBQVFBMEQsT0FBTyxDQUFDdEIsRUFBUixDQUFXLE9BQVgsRUFBb0IsQ0FBQztBQUFFL0IsRUFBQUEsT0FBRjtBQUFXTSxFQUFBQSxRQUFYO0FBQXFCcEIsRUFBQUE7QUFBckIsQ0FBRCxLQUF1QztBQUN6RG9FLEVBQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUFldkQsT0FBTyxDQUFDTyxJQUFSLEtBQWlCaUQscUJBQVl4QyxHQUE1QyxFQUFpRCxzQkFBakQ7O0FBQ0EsUUFBTXJCLE1BQU0sR0FBR0gsYUFBUUQsSUFBUixDQUFhUyxPQUFiLENBQWY7O0FBQ0EsTUFBSUwsTUFBSixFQUFZO0FBQ1YwRCxJQUFBQSxPQUFPLENBQUNuQixjQUFSLENBQXVCdkMsTUFBdkIsRUFBK0JULFVBQS9CO0FBQ0Q7QUFDRixDQU5EO0FBUUFrRCxPQUFPLENBQUNMLEVBQVIsQ0FBVyxRQUFYLEVBQXFCLE1BQU1zQixPQUFPLENBQUNqRCxLQUFSLEVBQTNCO0FBQ0FnQyxPQUFPLENBQUNMLEVBQVIsQ0FBVyxTQUFYLEVBQXNCLE1BQU1zQixPQUFPLENBQUNqRCxLQUFSLEVBQTVCO2VBRWVpRCxPIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgU29ja2V0IH0gZnJvbSAnbmV0JztcbmltcG9ydCBBZGRyZXNzLCB7IEFkZHJlc3NQYXJhbSwgQWRkcmVzc1R5cGUgfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IENsaWVudCwgSVBvcnRBcmcgfSBmcm9tICcuLi9pcGMnO1xuaW1wb3J0IHsgZGV2aWNlcywgSURldmljZSwgdG9JbnQgfSBmcm9tICcuLi9taWInO1xuaW1wb3J0IHsgZ2V0TWliRmlsZSwgSU1pYkRldmljZVR5cGUgfSBmcm9tICcuLi9taWIvZGV2aWNlcyc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjcmVhdGVObXNSZWFkIH0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBTYXJwRGF0YWdyYW0gZnJvbSAnLi4vc2FycC9TYXJwRGF0YWdyYW0nO1xuaW1wb3J0IHsgUEFUSCB9IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IENhdGVnb3J5IH0gZnJvbSAnLi9Lbm93blBvcnRzJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOnNlc3Npb24nKTtcbmNvbnN0IG5vb3AgPSAoKSA9PiB7fTtcblxudHlwZSBGb3VuZExpc3RlbmVyID1cbiAgKGFyZzogeyBjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24sIGNhdGVnb3J5OiBDYXRlZ29yeSwgYWRkcmVzczogQWRkcmVzcyB9KSA9PiB2b2lkO1xuXG50eXBlIENvbm5lY3Rpb25MaXN0ZW5lciA9IChjb25uZWN0aW9uOiBOaWJ1c0Nvbm5lY3Rpb24pID0+IHZvaWQ7XG50eXBlIERldmljZUxpc3RlbmVyID0gKGRldmljZTogSURldmljZSkgPT4gdm9pZDtcblxuZGVjbGFyZSBpbnRlcmZhY2UgTmlidXNTZXNzaW9uIHtcbiAgb24oZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICBvbihldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2FkZCcgfCAncmVtb3ZlJywgbGlzdGVuZXI6IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnc3RhcnQnIHwgJ2Nsb3NlJywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcztcbiAgb25jZShldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6IERldmljZUxpc3RlbmVyKTogdGhpcztcbn1cblxuY2xhc3MgTmlidXNTZXNzaW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBjb25uZWN0aW9uczogTmlidXNDb25uZWN0aW9uW10gPSBbXTtcbiAgcHJpdmF0ZSBpc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzb2NrZXQ/OiBTb2NrZXQ7IC8vID0gQ2xpZW50LmNvbm5lY3QoUEFUSCk7XG5cbiAgcHJpdmF0ZSByZWxvYWRIYW5kbGVyID0gKHBvcnRzOiBJUG9ydEFyZ1tdKSA9PiB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuY29ubmVjdGlvbnMuc3BsaWNlKDAsIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKTtcbiAgICBwb3J0cy5mb3JFYWNoKChwb3J0KSA9PiB7XG4gICAgICBjb25zdCB7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSB9ID0gcG9ydDtcbiAgICAgIGNvbnN0IGluZGV4ID0gXy5maW5kSW5kZXgocHJldiwgeyBwYXRoOiBjb21OYW1lIH0pO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zLnB1c2gocHJldi5zcGxpY2UoaW5kZXgsIDEpWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWRkSGFuZGxlcihwb3J0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBwcmV2LmZvckVhY2goY29ubmVjdGlvbiA9PiB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBhZGRIYW5kbGVyID0gKHsgcG9ydEluZm86IHsgY29tTmFtZSB9LCBkZXNjcmlwdGlvbiB9OiBJUG9ydEFyZykgPT4ge1xuICAgIGRlYnVnKCdhZGQnKTtcbiAgICBjb25zdCBjb25uZWN0aW9uID0gbmV3IE5pYnVzQ29ubmVjdGlvbihjb21OYW1lLCBkZXNjcmlwdGlvbik7XG4gICAgdGhpcy5jb25uZWN0aW9ucy5wdXNoKGNvbm5lY3Rpb24pO1xuICAgIHRoaXMuZW1pdCgnYWRkJywgY29ubmVjdGlvbik7XG4gICAgdGhpcy5maW5kKGNvbm5lY3Rpb24pO1xuICAgIGRldmljZXMuZ2V0KClcbiAgICAgIC5maWx0ZXIoZGV2aWNlID0+IGRldmljZS5jb25uZWN0aW9uID09IG51bGwpXG4gICAgICAucmVkdWNlKGFzeW5jIChwcm9taXNlLCBkZXZpY2UpID0+IHtcbiAgICAgICAgYXdhaXQgcHJvbWlzZTtcbiAgICAgICAgZGVidWcoJ3N0YXJ0IHBpbmcnKTtcbiAgICAgICAgY29uc3QgdGltZSA9IGF3YWl0IGNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcyk7XG4gICAgICAgIGRlYnVnKGBwaW5nICR7dGltZX1gKTtcbiAgICAgICAgaWYgKHRpbWUgIT09IC0xKSB7XG4gICAgICAgICAgZGV2aWNlLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICAgICAgICAgIC8qKlxuICAgICAgICAgICAqIE5ldyBjb25uZWN0ZWQgZGV2aWNlXG4gICAgICAgICAgICogQGV2ZW50IE5pYnVzU2Vzc2lvbiNjb25uZWN0ZWRcbiAgICAgICAgICAgKiBAdHlwZSBJRGV2aWNlXG4gICAgICAgICAgICovXG4gICAgICAgICAgdGhpcy5lbWl0KCdjb25uZWN0ZWQnLCBkZXZpY2UpO1xuICAgICAgICAgIC8vIGRldmljZS5lbWl0KCdjb25uZWN0ZWQnKTtcbiAgICAgICAgICBkZWJ1ZyhgbWliLWRldmljZSAke2RldmljZS5hZGRyZXNzfSB3YXMgY29ubmVjdGVkYCk7XG4gICAgICAgIH1cbiAgICAgIH0sIFByb21pc2UucmVzb2x2ZSgpKVxuICAgICAgLmNhdGNoKG5vb3ApO1xuICB9O1xuXG4gIHByaXZhdGUgY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikge1xuICAgIGNvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICBkZXZpY2VzLmdldCgpXG4gICAgICAuZmlsdGVyKGRldmljZSA9PiBkZXZpY2UuY29ubmVjdGlvbiA9PT0gY29ubmVjdGlvbilcbiAgICAgIC5mb3JFYWNoKChkZXZpY2UpID0+IHtcbiAgICAgICAgZGV2aWNlLmNvbm5lY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgICAgZGVidWcoYG1pYi1kZXZpY2UgJHtkZXZpY2UuYWRkcmVzc30gd2FzIGRpc2Nvbm5lY3RlZGApO1xuICAgICAgfSk7XG4gICAgdGhpcy5lbWl0KCdyZW1vdmUnLCBjb25uZWN0aW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlSGFuZGxlciA9ICh7IHBvcnRJbmZvOiB7IGNvbU5hbWUgfSB9OiBJUG9ydEFyZykgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jb25uZWN0aW9ucy5maW5kSW5kZXgoKHsgcGF0aCB9KSA9PiBjb21OYW1lID09PSBwYXRoKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBbY29ubmVjdGlvbl0gPSB0aGlzLmNvbm5lY3Rpb25zLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKTtcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSBmaW5kKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHsgZGVzY3JpcHRpb24gfSA9IGNvbm5lY3Rpb247XG4gICAgY29uc3QgeyBjYXRlZ29yeSB9ID0gZGVzY3JpcHRpb247XG4gICAgc3dpdGNoIChkZXNjcmlwdGlvbi5maW5kKSB7XG4gICAgICBjYXNlICdzYXJwJzoge1xuICAgICAgICBsZXQgeyB0eXBlIH0gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IG1pYiA9IHJlcXVpcmUoZ2V0TWliRmlsZShkZXNjcmlwdGlvbi5taWIhKSk7XG4gICAgICAgICAgY29uc3QgeyB0eXBlcyB9ID0gbWliO1xuICAgICAgICAgIGNvbnN0IGRldmljZSA9IHR5cGVzW21pYi5kZXZpY2VdIGFzIElNaWJEZXZpY2VUeXBlO1xuICAgICAgICAgIHR5cGUgPSB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29ubmVjdGlvbi5vbmNlKCdzYXJwJywgKHNhcnBEYXRhZ3JhbTogU2FycERhdGFncmFtKSA9PiB7XG4gICAgICAgICAgY29uc3QgYWRkcmVzcyA9IG5ldyBBZGRyZXNzKHNhcnBEYXRhZ3JhbS5tYWMpO1xuICAgICAgICAgIGRlYnVnKGBkZXZpY2UgJHtjYXRlZ29yeX1bJHthZGRyZXNzfV0gd2FzIGZvdW5kIG9uICR7Y29ubmVjdGlvbi5wYXRofWApO1xuICAgICAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgICAgICdmb3VuZCcsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNvbm5lY3Rpb24sXG4gICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICBhZGRyZXNzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgY29ubmVjdGlvbi5maW5kQnlUeXBlKHR5cGUpLmNhdGNoKG5vb3ApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ3ZlcnNpb24nOlxuICAgICAgICBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShjcmVhdGVObXNSZWFkKEFkZHJlc3MuZW1wdHksIDIpKVxuICAgICAgICAgIC50aGVuKChkYXRhZ3JhbSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFkYXRhZ3JhbSB8fCBBcnJheS5pc0FycmF5KGRhdGFncmFtKSkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9IG5ldyBBZGRyZXNzKGRhdGFncmFtLnNvdXJjZS5tYWMpO1xuICAgICAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICAgICAnZm91bmQnLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29ubmVjdGlvbixcbiAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRlYnVnKGBkZXZpY2UgJHtjYXRlZ29yeX1bJHthZGRyZXNzfV0gd2FzIGZvdW5kIG9uICR7Y29ubmVjdGlvbi5wYXRofWApO1xuICAgICAgICAgIH0sIG5vb3ApO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIHB1YmxpYyBhc3luYyBzdGFydCh3YXRjaCA9IHRydWUpIHtcbiAgLy8gICBpZiAodGhpcy5pc1N0YXJ0ZWQpIHJldHVybjtcbiAgLy8gICBjb25zdCB7IGRldGVjdGlvbiB9ID0gZGV0ZWN0b3I7XG4gIC8vICAgaWYgKGRldGVjdGlvbiA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoJ2RldGVjdGlvbiBpcyBOL0EnKTtcbiAgLy8gICBkZXRlY3Rvci5vbignYWRkJywgdGhpcy5hZGRIYW5kbGVyKTtcbiAgLy8gICBkZXRlY3Rvci5vbigncmVtb3ZlJywgdGhpcy5yZW1vdmVIYW5kbGVyKTtcbiAgLy8gICBhd2FpdCBkZXRlY3Rvci5nZXRQb3J0cygpO1xuICAvL1xuICAvLyAgIGlmICh3YXRjaCkgZGV0ZWN0b3Iuc3RhcnQoKTtcbiAgLy8gICB0aGlzLmlzU3RhcnRlZCA9IHRydWU7XG4gIC8vICAgcHJvY2Vzcy5vbmNlKCdTSUdJTlQnLCAoKSA9PiB0aGlzLnN0b3AoKSk7XG4gIC8vICAgcHJvY2Vzcy5vbmNlKCdTSUdURVJNJywgKCkgPT4gdGhpcy5zdG9wKCkpO1xuICAvLyAgIC8qKlxuICAvLyAgICAqIEBldmVudCBOaWJ1c1NlcnZpY2Ujc3RhcnRcbiAgLy8gICAgKi9cbiAgLy8gICB0aGlzLmVtaXQoJ3N0YXJ0Jyk7XG4gIC8vICAgZGVidWcoJ3N0YXJ0ZWQnKTtcbiAgLy8gfVxuICAvL1xuICBzdGFydCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPigocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNTdGFydGVkKSByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgdGhpcy5zb2NrZXQgPSBDbGllbnQuY29ubmVjdChQQVRIKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdwb3J0cycsIHRoaXMucmVsb2FkSGFuZGxlcik7XG4gICAgICB0aGlzLnNvY2tldC5vbignYWRkJywgdGhpcy5hZGRIYW5kbGVyKTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUhhbmRsZXIpO1xuICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zb2NrZXQub25jZSgncG9ydHMnLCAocG9ydHMpID0+IHtcbiAgICAgICAgcmVzb2x2ZShwb3J0cy5sZW5ndGgpO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXJ0Jyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpmdW5jdGlvbi1uYW1lXG4gIF9jb25uZWN0RGV2aWNlKGRldmljZTogSURldmljZSwgY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgaWYgKGRldmljZS5jb25uZWN0aW9uID09PSBjb25uZWN0aW9uKSByZXR1cm47XG4gICAgZGV2aWNlLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICAgIGNvbnN0IGV2ZW50ID0gY29ubmVjdGlvbiA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCc7XG4gICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoZXZlbnQsIGRldmljZSkpO1xuICAgIC8vIGRldmljZS5lbWl0KCdjb25uZWN0ZWQnKTtcbiAgICBkZWJ1ZyhgbWliLWRldmljZSBbJHtkZXZpY2UuYWRkcmVzc31dIHdhcyAke2V2ZW50fWApO1xuICB9XG5cbiAgcHVibGljIGNsb3NlKCkge1xuICAgIGlmICghdGhpcy5pc1N0YXJ0ZWQpIHJldHVybjtcbiAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdjbG9zZScpO1xuICAgIC8qKlxuICAgICAqIEBldmVudCBOaWJ1c1Nlc3Npb24jY2xvc2VcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG4gICAgLy8gZGV0ZWN0b3Iuc3RvcCgpO1xuICAgIHRoaXMuY29ubmVjdGlvbnNcbiAgICAgIC5zcGxpY2UoMCwgdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpXG4gICAgICAuZm9yRWFjaChjb25uZWN0aW9uID0+IHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pKTtcbiAgICB0aGlzLnNvY2tldCAmJiB0aGlzLnNvY2tldC5kZXN0cm95KCk7XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIC8vXG4gIGFzeW5jIHBpbmdEZXZpY2UoZGV2aWNlOiBJRGV2aWNlKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb25zIH0gPSB0aGlzO1xuICAgIGlmIChkZXZpY2UuY29ubmVjdGlvbiAmJiBjb25uZWN0aW9ucy5pbmNsdWRlcyhkZXZpY2UuY29ubmVjdGlvbikpIHtcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBhd2FpdCBkZXZpY2UuY29ubmVjdGlvbi5waW5nKGRldmljZS5hZGRyZXNzKTtcbiAgICAgIGlmICh0aW1lb3V0ICE9PSAtMSkgcmV0dXJuIHRpbWVvdXQ7XG4gICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdGVkJywgZGV2aWNlKTtcbiAgICAgIC8vIGRldmljZS5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBtaWIgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpO1xuICAgIGNvbnN0IG9jY3VwaWVkID0gZGV2aWNlcy5nZXQoKVxuICAgICAgLm1hcChkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24hKVxuICAgICAgLmZpbHRlcihjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24gIT0gbnVsbCAmJiAhY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5saW5rKTtcbiAgICBjb25zdCBhY2NlcHRhYmxlcyA9IF8uZGlmZmVyZW5jZShjb25uZWN0aW9ucywgb2NjdXBpZWQpXG4gICAgICAuZmlsdGVyKCh7IGRlc2NyaXB0aW9uIH0pID0+IGRlc2NyaXB0aW9uLmxpbmsgfHwgZGVzY3JpcHRpb24ubWliID09PSBtaWIpO1xuICAgIGlmIChhY2NlcHRhYmxlcy5sZW5ndGggPT09IDApIHJldHVybiAtMTtcblxuICAgIGNvbnN0IFt0aW1lb3V0LCBjb25uZWN0aW9uXSA9IGF3YWl0IFByb21pc2UucmFjZShhY2NlcHRhYmxlcy5tYXAoXG4gICAgICBjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcylcbiAgICAgICAgLnRoZW4odCA9PiBbdCwgY29ubmVjdGlvbl0gYXMgW251bWJlciwgTmlidXNDb25uZWN0aW9uXSkpKTtcbiAgICBpZiAodGltZW91dCA9PT0gLTEpIHtcbiAgICAgIC8vIHBpbmcoYWNjZXB0YWJsZXNbMF0sIGRldmljZS5hZGRyZXNzKTtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICB0aGlzLl9jb25uZWN0RGV2aWNlKGRldmljZSwgY29ubmVjdGlvbik7XG4gICAgcmV0dXJuIHRpbWVvdXQ7XG4gIH1cblxuICBhc3luYyBwaW5nKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9ucyB9ID0gdGhpcztcbiAgICBjb25zdCBhZGRyID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgtMSk7XG4gICAgcmV0dXJuIFByb21pc2UucmFjZShjb25uZWN0aW9ucy5tYXAoY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uLnBpbmcoYWRkcikpKTtcbiAgfVxufVxuXG5jb25zdCBzZXNzaW9uID0gbmV3IE5pYnVzU2Vzc2lvbigpO1xuXG5kZXZpY2VzLm9uKCduZXcnLCAoZGV2aWNlOiBJRGV2aWNlKSA9PiB7XG4gIGlmICghZGV2aWNlLmNvbm5lY3Rpb24pIHtcbiAgICBzZXNzaW9uLnBpbmdEZXZpY2UoZGV2aWNlKS5jYXRjaChub29wKTtcbiAgfVxufSk7XG5cbmRldmljZXMub24oJ2RlbGV0ZScsIChkZXZpY2U6IElEZXZpY2UpID0+IHtcbiAgaWYgKGRldmljZS5jb25uZWN0aW9uKSB7XG4gICAgZGV2aWNlLmNvbm5lY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgc2Vzc2lvbi5lbWl0KCdkaXNjb25uZWN0ZWQnLCBkZXZpY2UpO1xuICAgIC8vIGRldmljZS5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgfVxufSk7XG5cbnNlc3Npb24ub24oJ2ZvdW5kJywgKHsgYWRkcmVzcywgY2F0ZWdvcnksIGNvbm5lY3Rpb24gfSkgPT4ge1xuICBjb25zb2xlLmFzc2VydChhZGRyZXNzLnR5cGUgPT09IEFkZHJlc3NUeXBlLm1hYywgJ21hYy1hZGRyZXNzIGV4cGVjdGVkJyk7XG4gIGNvbnN0IGRldmljZSA9IGRldmljZXMuZmluZChhZGRyZXNzKTtcbiAgaWYgKGRldmljZSkge1xuICAgIHNlc3Npb24uX2Nvbm5lY3REZXZpY2UoZGV2aWNlLCBjb25uZWN0aW9uKTtcbiAgfVxufSk7XG5cbnByb2Nlc3Mub24oJ1NJR0lOVCcsICgpID0+IHNlc3Npb24uY2xvc2UoKSk7XG5wcm9jZXNzLm9uKCdTSUdURVJNJywgKCkgPT4gc2Vzc2lvbi5jbG9zZSgpKTtcblxuZXhwb3J0IGRlZmF1bHQgc2Vzc2lvbjtcbiJdfQ==