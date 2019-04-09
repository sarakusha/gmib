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
      if (this.isStarted) return resolve(this.connections.length);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL3Nlc3Npb24udHMiXSwibmFtZXMiOlsiZGVidWciLCJub29wIiwiTmlidXNTZXNzaW9uIiwiRXZlbnRFbWl0dGVyIiwicG9ydHMiLCJwcmV2IiwiY29ubmVjdGlvbnMiLCJzcGxpY2UiLCJsZW5ndGgiLCJmb3JFYWNoIiwicG9ydCIsInBvcnRJbmZvIiwiY29tTmFtZSIsImluZGV4IiwiXyIsImZpbmRJbmRleCIsInBhdGgiLCJwdXNoIiwiYWRkSGFuZGxlciIsImNvbm5lY3Rpb24iLCJjbG9zZUNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiIsIk5pYnVzQ29ubmVjdGlvbiIsImVtaXQiLCJmaW5kIiwiZGV2aWNlcyIsImdldCIsImZpbHRlciIsImRldmljZSIsInJlZHVjZSIsInByb21pc2UiLCJ0aW1lIiwicGluZyIsImFkZHJlc3MiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNhdGNoIiwiY2xvc2UiLCJ1bmRlZmluZWQiLCJjYXRlZ29yeSIsInR5cGUiLCJtaWIiLCJyZXF1aXJlIiwidHlwZXMiLCJhcHBpbmZvIiwiZGV2aWNlX3R5cGUiLCJvbmNlIiwic2FycERhdGFncmFtIiwiQWRkcmVzcyIsIm1hYyIsImZpbmRCeVR5cGUiLCJzZW5kRGF0YWdyYW0iLCJlbXB0eSIsInRoZW4iLCJkYXRhZ3JhbSIsIkFycmF5IiwiaXNBcnJheSIsInNvdXJjZSIsInN0YXJ0IiwiaXNTdGFydGVkIiwic29ja2V0IiwiQ2xpZW50IiwiY29ubmVjdCIsIlBBVEgiLCJvbiIsInJlbG9hZEhhbmRsZXIiLCJyZW1vdmVIYW5kbGVyIiwiX2Nvbm5lY3REZXZpY2UiLCJldmVudCIsInByb2Nlc3MiLCJuZXh0VGljayIsImRlc3Ryb3kiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJwaW5nRGV2aWNlIiwiaW5jbHVkZXMiLCJ0aW1lb3V0IiwiUmVmbGVjdCIsImdldE1ldGFkYXRhIiwib2NjdXBpZWQiLCJtYXAiLCJsaW5rIiwiYWNjZXB0YWJsZXMiLCJkaWZmZXJlbmNlIiwicmFjZSIsInQiLCJhZGRyIiwic2Vzc2lvbiIsImNvbnNvbGUiLCJhc3NlcnQiLCJBZGRyZXNzVHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7Ozs7Ozs7O0FBR0EsTUFBTUEsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDs7QUFDQSxNQUFNQyxJQUFJLEdBQUcsTUFBTSxDQUFFLENBQXJCOztBQTJCQSxNQUFNQyxZQUFOLFNBQTJCQyxvQkFBM0IsQ0FBd0M7QUFBQTtBQUFBOztBQUFBLHlDQUNZLEVBRFo7O0FBQUEsdUNBRWxCLEtBRmtCOztBQUFBOztBQUFBLDJDQUtiQyxLQUFELElBQXVCO0FBQzdDLFlBQU1DLElBQUksR0FBRyxLQUFLQyxXQUFMLENBQWlCQyxNQUFqQixDQUF3QixDQUF4QixFQUEyQixLQUFLRCxXQUFMLENBQWlCRSxNQUE1QyxDQUFiO0FBQ0FKLE1BQUFBLEtBQUssQ0FBQ0ssT0FBTixDQUFlQyxJQUFELElBQVU7QUFDdEIsY0FBTTtBQUFFQyxVQUFBQSxRQUFRLEVBQUU7QUFBRUMsWUFBQUE7QUFBRjtBQUFaLFlBQTRCRixJQUFsQzs7QUFDQSxjQUFNRyxLQUFLLEdBQUdDLGdCQUFFQyxTQUFGLENBQVlWLElBQVosRUFBa0I7QUFBRVcsVUFBQUEsSUFBSSxFQUFFSjtBQUFSLFNBQWxCLENBQWQ7O0FBQ0EsWUFBSUMsS0FBSyxLQUFLLENBQUMsQ0FBZixFQUFrQjtBQUNoQixlQUFLUCxXQUFMLENBQWlCVyxJQUFqQixDQUFzQlosSUFBSSxDQUFDRSxNQUFMLENBQVlNLEtBQVosRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsQ0FBdEI7QUFDRCxTQUZELE1BRU87QUFDTCxlQUFLSyxVQUFMLENBQWdCUixJQUFoQjtBQUNEO0FBQ0YsT0FSRDtBQVNBTCxNQUFBQSxJQUFJLENBQUNJLE9BQUwsQ0FBYVUsVUFBVSxJQUFJLEtBQUtDLGVBQUwsQ0FBcUJELFVB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QUFDVCxVQUFYLEVBQXVCO0FBQ3JCUyxJQUFBQSxNQUFNLENBQUNULFVBQVAsR0FBb0JtQixTQUFwQjtBQUNBZ0QsSUFBQUEsT0FBTyxDQUFDL0QsSUFBUixDQUFhLGNBQWIsRUFBNkJLLE1BQTdCLEVBRnFCLENBR3JCO0FBQ0Q7QUFDRixDQU5EOztBQVFBMEQsT0FBTyxDQUFDdEIsRUFBUixDQUFXLE9BQVgsRUFBb0IsQ0FBQztBQUFFL0IsRUFBQUEsT0FBRjtBQUFXTSxFQUFBQSxRQUFYO0FBQXFCcEIsRUFBQUE7QUFBckIsQ0FBRCxLQUF1QztBQUN6RG9FLEVBQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUFldkQsT0FBTyxDQUFDTyxJQUFSLEtBQWlCaUQscUJBQVl4QyxHQUE1QyxFQUFpRCxzQkFBakQ7O0FBQ0EsUUFBTXJCLE1BQU0sR0FBR0gsYUFBUUQsSUFBUixDQUFhUyxPQUFiLENBQWY7O0FBQ0EsTUFBSUwsTUFBSixFQUFZO0FBQ1YwRCxJQUFBQSxPQUFPLENBQUNuQixjQUFSLENBQXVCdkMsTUFBdkIsRUFBK0JULFVBQS9CO0FBQ0Q7QUFDRixDQU5EO0FBUUFrRCxPQUFPLENBQUNMLEVBQVIsQ0FBVyxRQUFYLEVBQXFCLE1BQU1zQixPQUFPLENBQUNqRCxLQUFSLEVBQTNCO0FBQ0FnQyxPQUFPLENBQUNMLEVBQVIsQ0FBVyxTQUFYLEVBQXNCLE1BQU1zQixPQUFPLENBQUNqRCxLQUFSLEVBQTVCO2VBRWVpRCxPIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgU29ja2V0IH0gZnJvbSAnbmV0JztcbmltcG9ydCBBZGRyZXNzLCB7IEFkZHJlc3NQYXJhbSwgQWRkcmVzc1R5cGUgfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IENsaWVudCwgSVBvcnRBcmcgfSBmcm9tICcuLi9pcGMnO1xuaW1wb3J0IHsgZGV2aWNlcywgSURldmljZSwgdG9JbnQgfSBmcm9tICcuLi9taWInO1xuaW1wb3J0IHsgZ2V0TWliRmlsZSwgSU1pYkRldmljZVR5cGUgfSBmcm9tICcuLi9taWIvZGV2aWNlcyc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjcmVhdGVObXNSZWFkIH0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBTYXJwRGF0YWdyYW0gZnJvbSAnLi4vc2FycC9TYXJwRGF0YWdyYW0nO1xuaW1wb3J0IHsgUEFUSCB9IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IENhdGVnb3J5IH0gZnJvbSAnLi9Lbm93blBvcnRzJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOnNlc3Npb24nKTtcbmNvbnN0IG5vb3AgPSAoKSA9PiB7fTtcblxuZXhwb3J0IHR5cGUgRm91bmRMaXN0ZW5lciA9XG4gIChhcmc6IHsgY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uLCBjYXRlZ29yeTogQ2F0ZWdvcnksIGFkZHJlc3M6IEFkZHJlc3MgfSkgPT4gdm9pZDtcblxuZXhwb3J0IHR5cGUgQ29ubmVjdGlvbkxpc3RlbmVyID0gKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIERldmljZUxpc3RlbmVyID0gKGRldmljZTogSURldmljZSkgPT4gdm9pZDtcblxuZGVjbGFyZSBpbnRlcmZhY2UgTmlidXNTZXNzaW9uIHtcbiAgb24oZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICBvbihldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2FkZCcgfCAncmVtb3ZlJywgbGlzdGVuZXI6IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnc3RhcnQnIHwgJ2Nsb3NlJywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcztcbiAgb25jZShldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnYWRkJyB8ICdyZW1vdmUnLCBsaXN0ZW5lcjogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6IERldmljZUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnc3RhcnQnIHwgJ2Nsb3NlJywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZm91bmQnLCBsaXN0ZW5lcjogRm91bmRMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2FkZCcgfCAncmVtb3ZlJywgbGlzdGVuZXI6IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6IERldmljZUxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdzdGFydCcgfCAnY2xvc2UnLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2ZvdW5kJywgbGlzdGVuZXI6IEZvdW5kTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2FkZCcgfCAncmVtb3ZlJywgbGlzdGVuZXI6IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogRGV2aWNlTGlzdGVuZXIpOiB0aGlzO1xufVxuXG5jbGFzcyBOaWJ1c1Nlc3Npb24gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbm5lY3Rpb25zOiBOaWJ1c0Nvbm5lY3Rpb25bXSA9IFtdO1xuICBwcml2YXRlIGlzU3RhcnRlZCA9IGZhbHNlO1xuICBwcml2YXRlIHNvY2tldD86IFNvY2tldDsgLy8gPSBDbGllbnQuY29ubmVjdChQQVRIKTtcblxuICBwcml2YXRlIHJlbG9hZEhhbmRsZXIgPSAocG9ydHM6IElQb3J0QXJnW10pID0+IHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5jb25uZWN0aW9ucy5zcGxpY2UoMCwgdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpO1xuICAgIHBvcnRzLmZvckVhY2goKHBvcnQpID0+IHtcbiAgICAgIGNvbnN0IHsgcG9ydEluZm86IHsgY29tTmFtZSB9IH0gPSBwb3J0O1xuICAgICAgY29uc3QgaW5kZXggPSBfLmZpbmRJbmRleChwcmV2LCB7IHBhdGg6IGNvbU5hbWUgfSk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnMucHVzaChwcmV2LnNwbGljZShpbmRleCwgMSlbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hZGRIYW5kbGVyKHBvcnQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHByZXYuZm9yRWFjaChjb25uZWN0aW9uID0+IHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pKTtcbiAgfTtcblxuICBwcml2YXRlIGFkZEhhbmRsZXIgPSAoeyBwb3J0SW5mbzogeyBjb21OYW1lIH0sIGRlc2NyaXB0aW9uIH06IElQb3J0QXJnKSA9PiB7XG4gICAgZGVidWcoJ2FkZCcpO1xuICAgIGNvbnN0IGNvbm5lY3Rpb24gPSBuZXcgTmlidXNDb25uZWN0aW9uKGNvbU5hbWUsIGRlc2NyaXB0aW9uKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zLnB1c2goY29ubmVjdGlvbik7XG4gICAgdGhpcy5lbWl0KCdhZGQnLCBjb25uZWN0aW9uKTtcbiAgICB0aGlzLmZpbmQoY29ubmVjdGlvbik7XG4gICAgZGV2aWNlcy5nZXQoKVxuICAgICAgLmZpbHRlcihkZXZpY2UgPT4gZGV2aWNlLmNvbm5lY3Rpb24gPT0gbnVsbClcbiAgICAgIC5yZWR1Y2UoYXN5bmMgKHByb21pc2UsIGRldmljZSkgPT4ge1xuICAgICAgICBhd2FpdCBwcm9taXNlO1xuICAgICAgICBkZWJ1Zygnc3RhcnQgcGluZycpO1xuICAgICAgICBjb25zdCB0aW1lID0gYXdhaXQgY29ubmVjdGlvbi5waW5nKGRldmljZS5hZGRyZXNzKTtcbiAgICAgICAgZGVidWcoYHBpbmcgJHt0aW1lfWApO1xuICAgICAgICBpZiAodGltZSAhPT0gLTEpIHtcbiAgICAgICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogTmV3IGNvbm5lY3RlZCBkZXZpY2VcbiAgICAgICAgICAgKiBAZXZlbnQgTmlidXNTZXNzaW9uI2Nvbm5lY3RlZFxuICAgICAgICAgICAqIEB0eXBlIElEZXZpY2VcbiAgICAgICAgICAgKi9cbiAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAgICAgLy8gZGV2aWNlLmVtaXQoJ2Nvbm5lY3RlZCcpO1xuICAgICAgICAgIGRlYnVnKGBtaWItZGV2aWNlICR7ZGV2aWNlLmFkZHJlc3N9IHdhcyBjb25uZWN0ZWRgKTtcbiAgICAgICAgfVxuICAgICAgfSwgUHJvbWlzZS5yZXNvbHZlKCkpXG4gICAgICAuY2F0Y2gobm9vcCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBjbG9zZUNvbm5lY3Rpb24oY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgIGRldmljZXMuZ2V0KClcbiAgICAgIC5maWx0ZXIoZGV2aWNlID0+IGRldmljZS5jb25uZWN0aW9uID09PSBjb25uZWN0aW9uKVxuICAgICAgLmZvckVhY2goKGRldmljZSkgPT4ge1xuICAgICAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0ZWQnLCBkZXZpY2UpO1xuICAgICAgICBkZWJ1ZyhgbWliLWRldmljZSAke2RldmljZS5hZGRyZXNzfSB3YXMgZGlzY29ubmVjdGVkYCk7XG4gICAgICB9KTtcbiAgICB0aGlzLmVtaXQoJ3JlbW92ZScsIGNvbm5lY3Rpb24pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVIYW5kbGVyID0gKHsgcG9ydEluZm86IHsgY29tTmFtZSB9IH06IElQb3J0QXJnKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmNvbm5lY3Rpb25zLmZpbmRJbmRleCgoeyBwYXRoIH0pID0+IGNvbU5hbWUgPT09IHBhdGgpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IFtjb25uZWN0aW9uXSA9IHRoaXMuY29ubmVjdGlvbnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIHRoaXMuY2xvc2VDb25uZWN0aW9uKGNvbm5lY3Rpb24pO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGZpbmQoY29ubmVjdGlvbjogTmlidXNDb25uZWN0aW9uKSB7XG4gICAgY29uc3QgeyBkZXNjcmlwdGlvbiB9ID0gY29ubmVjdGlvbjtcbiAgICBjb25zdCB7IGNhdGVnb3J5IH0gPSBkZXNjcmlwdGlvbjtcbiAgICBzd2l0Y2ggKGRlc2NyaXB0aW9uLmZpbmQpIHtcbiAgICAgIGNhc2UgJ3NhcnAnOiB7XG4gICAgICAgIGxldCB7IHR5cGUgfSA9IGRlc2NyaXB0aW9uO1xuICAgICAgICBpZiAodHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgbWliID0gcmVxdWlyZShnZXRNaWJGaWxlKGRlc2NyaXB0aW9uLm1pYiEpKTtcbiAgICAgICAgICBjb25zdCB7IHR5cGVzIH0gPSBtaWI7XG4gICAgICAgICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gICAgICAgICAgdHlwZSA9IHRvSW50KGRldmljZS5hcHBpbmZvLmRldmljZV90eXBlKTtcbiAgICAgICAgfVxuICAgICAgICBjb25uZWN0aW9uLm9uY2UoJ3NhcnAnLCAoc2FycERhdGFncmFtOiBTYXJwRGF0YWdyYW0pID0+IHtcbiAgICAgICAgICBjb25zdCBhZGRyZXNzID0gbmV3IEFkZHJlc3Moc2FycERhdGFncmFtLm1hYyk7XG4gICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICAgJ2ZvdW5kJyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY29ubmVjdGlvbixcbiAgICAgICAgICAgICAgY2F0ZWdvcnksXG4gICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25uZWN0aW9uLmZpbmRCeVR5cGUodHlwZSkuY2F0Y2gobm9vcCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAndmVyc2lvbic6XG4gICAgICAgIGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGNyZWF0ZU5tc1JlYWQoQWRkcmVzcy5lbXB0eSwgMikpXG4gICAgICAgICAgLnRoZW4oKGRhdGFncmFtKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWRhdGFncmFtIHx8IEFycmF5LmlzQXJyYXkoZGF0YWdyYW0pKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBhZGRyZXNzID0gbmV3IEFkZHJlc3MoZGF0YWdyYW0uc291cmNlLm1hYyk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoXG4gICAgICAgICAgICAgICdmb3VuZCcsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIGFkZHJlc3MsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZGVidWcoYGRldmljZSAke2NhdGVnb3J5fVske2FkZHJlc3N9XSB3YXMgZm91bmQgb24gJHtjb25uZWN0aW9uLnBhdGh9YCk7XG4gICAgICAgICAgfSwgbm9vcCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gcHVibGljIGFzeW5jIHN0YXJ0KHdhdGNoID0gdHJ1ZSkge1xuICAvLyAgIGlmICh0aGlzLmlzU3RhcnRlZCkgcmV0dXJuO1xuICAvLyAgIGNvbnN0IHsgZGV0ZWN0aW9uIH0gPSBkZXRlY3RvcjtcbiAgLy8gICBpZiAoZGV0ZWN0aW9uID09IG51bGwpIHRocm93IG5ldyBFcnJvcignZGV0ZWN0aW9uIGlzIE4vQScpO1xuICAvLyAgIGRldGVjdG9yLm9uKCdhZGQnLCB0aGlzLmFkZEhhbmRsZXIpO1xuICAvLyAgIGRldGVjdG9yLm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUhhbmRsZXIpO1xuICAvLyAgIGF3YWl0IGRldGVjdG9yLmdldFBvcnRzKCk7XG4gIC8vXG4gIC8vICAgaWYgKHdhdGNoKSBkZXRlY3Rvci5zdGFydCgpO1xuICAvLyAgIHRoaXMuaXNTdGFydGVkID0gdHJ1ZTtcbiAgLy8gICBwcm9jZXNzLm9uY2UoJ1NJR0lOVCcsICgpID0+IHRoaXMuc3RvcCgpKTtcbiAgLy8gICBwcm9jZXNzLm9uY2UoJ1NJR1RFUk0nLCAoKSA9PiB0aGlzLnN0b3AoKSk7XG4gIC8vICAgLyoqXG4gIC8vICAgICogQGV2ZW50IE5pYnVzU2VydmljZSNzdGFydFxuICAvLyAgICAqL1xuICAvLyAgIHRoaXMuZW1pdCgnc3RhcnQnKTtcbiAgLy8gICBkZWJ1Zygnc3RhcnRlZCcpO1xuICAvLyB9XG4gIC8vXG4gIHN0YXJ0KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KChyZXNvbHZlKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1N0YXJ0ZWQpIHJldHVybiByZXNvbHZlKHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gQ2xpZW50LmNvbm5lY3QoUEFUSCk7XG4gICAgICB0aGlzLnNvY2tldC5vbigncG9ydHMnLCB0aGlzLnJlbG9hZEhhbmRsZXIpO1xuICAgICAgdGhpcy5zb2NrZXQub24oJ2FkZCcsIHRoaXMuYWRkSGFuZGxlcik7XG4gICAgICB0aGlzLnNvY2tldC5vbigncmVtb3ZlJywgdGhpcy5yZW1vdmVIYW5kbGVyKTtcbiAgICAgIHRoaXMuaXNTdGFydGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc29ja2V0Lm9uY2UoJ3BvcnRzJywgKHBvcnRzKSA9PiB7XG4gICAgICAgIHJlc29sdmUocG9ydHMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5lbWl0KCdzdGFydCcpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6ZnVuY3Rpb24tbmFtZVxuICBfY29ubmVjdERldmljZShkZXZpY2U6IElEZXZpY2UsIGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbikge1xuICAgIGlmIChkZXZpY2UuY29ubmVjdGlvbiA9PT0gY29ubmVjdGlvbikgcmV0dXJuO1xuICAgIGRldmljZS5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICBjb25zdCBldmVudCA9IGNvbm5lY3Rpb24gPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnO1xuICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KGV2ZW50LCBkZXZpY2UpKTtcbiAgICAvLyBkZXZpY2UuZW1pdCgnY29ubmVjdGVkJyk7XG4gICAgZGVidWcoYG1pYi1kZXZpY2UgWyR7ZGV2aWNlLmFkZHJlc3N9XSB3YXMgJHtldmVudH1gKTtcbiAgfVxuXG4gIHB1YmxpYyBjbG9zZSgpIHtcbiAgICBpZiAoIXRoaXMuaXNTdGFydGVkKSByZXR1cm47XG4gICAgdGhpcy5pc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICBkZWJ1ZygnY2xvc2UnKTtcbiAgICAvKipcbiAgICAgKiBAZXZlbnQgTmlidXNTZXNzaW9uI2Nsb3NlXG4gICAgICovXG4gICAgdGhpcy5lbWl0KCdjbG9zZScpO1xuICAgIC8vIGRldGVjdG9yLnN0b3AoKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zXG4gICAgICAuc3BsaWNlKDAsIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKVxuICAgICAgLmZvckVhY2goY29ubmVjdGlvbiA9PiB0aGlzLmNsb3NlQ29ubmVjdGlvbihjb25uZWN0aW9uKSk7XG4gICAgdGhpcy5zb2NrZXQgJiYgdGhpcy5zb2NrZXQuZGVzdHJveSgpO1xuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICAvL1xuICBhc3luYyBwaW5nRGV2aWNlKGRldmljZTogSURldmljZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9ucyB9ID0gdGhpcztcbiAgICBpZiAoZGV2aWNlLmNvbm5lY3Rpb24gJiYgY29ubmVjdGlvbnMuaW5jbHVkZXMoZGV2aWNlLmNvbm5lY3Rpb24pKSB7XG4gICAgICBjb25zdCB0aW1lb3V0ID0gYXdhaXQgZGV2aWNlLmNvbm5lY3Rpb24ucGluZyhkZXZpY2UuYWRkcmVzcyk7XG4gICAgICBpZiAodGltZW91dCAhPT0gLTEpIHJldHVybiB0aW1lb3V0O1xuICAgICAgZGV2aWNlLmNvbm5lY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgICAvLyBkZXZpY2UuZW1pdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgfVxuXG4gICAgY29uc3QgbWliID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgZGV2aWNlKTtcbiAgICBjb25zdCBvY2N1cGllZCA9IGRldmljZXMuZ2V0KClcbiAgICAgIC5tYXAoZGV2aWNlID0+IGRldmljZS5jb25uZWN0aW9uISlcbiAgICAgIC5maWx0ZXIoY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uICE9IG51bGwgJiYgIWNvbm5lY3Rpb24uZGVzY3JpcHRpb24ubGluayk7XG4gICAgY29uc3QgYWNjZXB0YWJsZXMgPSBfLmRpZmZlcmVuY2UoY29ubmVjdGlvbnMsIG9jY3VwaWVkKVxuICAgICAgLmZpbHRlcigoeyBkZXNjcmlwdGlvbiB9KSA9PiBkZXNjcmlwdGlvbi5saW5rIHx8IGRlc2NyaXB0aW9uLm1pYiA9PT0gbWliKTtcbiAgICBpZiAoYWNjZXB0YWJsZXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTE7XG5cbiAgICBjb25zdCBbdGltZW91dCwgY29ubmVjdGlvbl0gPSBhd2FpdCBQcm9taXNlLnJhY2UoYWNjZXB0YWJsZXMubWFwKFxuICAgICAgY29ubmVjdGlvbiA9PiBjb25uZWN0aW9uLnBpbmcoZGV2aWNlLmFkZHJlc3MpXG4gICAgICAgIC50aGVuKHQgPT4gW3QsIGNvbm5lY3Rpb25dIGFzIFtudW1iZXIsIE5pYnVzQ29ubmVjdGlvbl0pKSk7XG4gICAgaWYgKHRpbWVvdXQgPT09IC0xKSB7XG4gICAgICAvLyBwaW5nKGFjY2VwdGFibGVzWzBdLCBkZXZpY2UuYWRkcmVzcyk7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgdGhpcy5fY29ubmVjdERldmljZShkZXZpY2UsIGNvbm5lY3Rpb24pO1xuICAgIHJldHVybiB0aW1lb3V0O1xuICB9XG5cbiAgYXN5bmMgcGluZyhhZGRyZXNzOiBBZGRyZXNzUGFyYW0pOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbnMgfSA9IHRoaXM7XG4gICAgY29uc3QgYWRkciA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIGlmIChjb25uZWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiBQcm9taXNlLnJlc29sdmUoLTEpO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoY29ubmVjdGlvbnMubWFwKGNvbm5lY3Rpb24gPT4gY29ubmVjdGlvbi5waW5nKGFkZHIpKSk7XG4gIH1cblxuICBnZXQgcG9ydHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoO1xuICB9XG59XG5cbmNvbnN0IHNlc3Npb24gPSBuZXcgTmlidXNTZXNzaW9uKCk7XG5cbmRldmljZXMub24oJ25ldycsIChkZXZpY2U6IElEZXZpY2UpID0+IHtcbiAgaWYgKCFkZXZpY2UuY29ubmVjdGlvbikge1xuICAgIHNlc3Npb24ucGluZ0RldmljZShkZXZpY2UpLmNhdGNoKG5vb3ApO1xuICB9XG59KTtcblxuZGV2aWNlcy5vbignZGVsZXRlJywgKGRldmljZTogSURldmljZSkgPT4ge1xuICBpZiAoZGV2aWNlLmNvbm5lY3Rpb24pIHtcbiAgICBkZXZpY2UuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBzZXNzaW9uLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcsIGRldmljZSk7XG4gICAgLy8gZGV2aWNlLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcpO1xuICB9XG59KTtcblxuc2Vzc2lvbi5vbignZm91bmQnLCAoeyBhZGRyZXNzLCBjYXRlZ29yeSwgY29ubmVjdGlvbiB9KSA9PiB7XG4gIGNvbnNvbGUuYXNzZXJ0KGFkZHJlc3MudHlwZSA9PT0gQWRkcmVzc1R5cGUubWFjLCAnbWFjLWFkZHJlc3MgZXhwZWN0ZWQnKTtcbiAgY29uc3QgZGV2aWNlID0gZGV2aWNlcy5maW5kKGFkZHJlc3MpO1xuICBpZiAoZGV2aWNlKSB7XG4gICAgc2Vzc2lvbi5fY29ubmVjdERldmljZShkZXZpY2UsIGNvbm5lY3Rpb24pO1xuICB9XG59KTtcblxucHJvY2Vzcy5vbignU0lHSU5UJywgKCkgPT4gc2Vzc2lvbi5jbG9zZSgpKTtcbnByb2Nlc3Mub24oJ1NJR1RFUk0nLCAoKSA9PiBzZXNzaW9uLmNsb3NlKCkpO1xuXG5leHBvcnQgZGVmYXVsdCBzZXNzaW9uO1xuIl19