"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.getNibusTimeout = exports.setNibusTimeout = exports.MINIHOST_TYPE = void 0;

require("source-map-support/register");

var _PathReporter = require("io-ts/lib/PathReporter");

var _lodash = _interopRequireDefault(require("lodash"));

var _net = require("net");

var _xpipe = _interopRequireDefault(require("xpipe"));

var _events = require("events");

var _debug = _interopRequireDefault(require("debug"));

var _errors = require("../errors");

var _ipc = require("../ipc");

var _nms = require("../nms");

var _NmsServiceType = _interopRequireDefault(require("../nms/NmsServiceType"));

var _sarp = require("../sarp");

var _MibDescription = require("../MibDescription");

var _NibusEncoder = _interopRequireDefault(require("./NibusEncoder"));

var _NibusDecoder = _interopRequireDefault(require("./NibusDecoder"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const MINIHOST_TYPE = 0xabc6; // const FIRMWARE_VERSION_ID = 0x85;

exports.MINIHOST_TYPE = MINIHOST_TYPE;
const VERSION_ID = 2;
const debug = (0, _debug.default)('nibus:connection');
let NIBUS_TIMEOUT = 1000;

const setNibusTimeout = timeout => {
  NIBUS_TIMEOUT = timeout;
};

exports.setNibusTimeout = setNibusTimeout;

const getNibusTimeout = () => NIBUS_TIMEOUT;

exports.getNibusTimeout = getNibusTimeout;

class WaitedNmsDatagram {
  constructor(req, resolve, reject, callback) {
    this.req = req;

    _defineProperty(this, "resolve", void 0);

    let timer;
    let counter = req.service !== _NmsServiceType.default.Read ? 1 : Math.floor(req.nms.length / 3) + 1;
    const datagrams = [];

    const timeout = () => {
      callback(this);
      datagrams.length === 0 ? reject(new _errors.TimeoutError(`Timeout error on ${req.destination} while ${_NmsServiceType.default[req.service]}`)) : resolve(datagrams);
    };

    const restart = (step = 1) => {
      counter -= step;
      clearTimeout(timer);

      if (counter > 0) {
        timer = setTimeout(timeout, req.timeout || NIBUS_TIMEOUT);
      } else if (counter === 0) {
        callback(this);
      }

      return counter === 0;
    };

    restart(0);

    this.resolve = datagram => {
      datagrams.push(datagram);

      if (restart()) {
        resolve(datagrams.length > 1 ? datagrams : datagram);
      }
    };
  }

}

class NibusConnection extends _events.EventEmitter {
  constructor(path, _description) {
    super();
    this.path = path;

    _defineProperty(this, "socket", void 0);

    _defineProperty(this, "encoder", new _NibusEncoder.default());

    _defineProperty(this, "decoder", new _NibusDecoder.default());

    _defineProperty(this, "ready", Promise.resolve());

    _defineProperty(this, "closed", false);

    _defineProperty(this, "waited", []);

    _defineProperty(this, "description", void 0);

    _defineProperty(this, "stopWaiting", waited => _lodash.default.remove(this.waited, waited));

    _defineProperty(this, "onDatagram", datagram => {
      let showLog = true;

      if (datagram instanceof _nms.NmsDatagram) {
        if (datagram.isResponse) {
          const resp = this.waited.find(item => datagram.isResponseFor(item.req));

          if (resp) {
            resp.resolve(datagram);
            showLog = false;
          }
        }

        this.emit('nms', datagram);
      } else if (datagram instanceof _sarp.SarpDatagram) {
        this.emit('sarp', datagram);
        showLog = false;
      }

      showLog && debug(`datagram received`, JSON.stringify(datagram.toJSON()));
    });

    _defineProperty(this, "close", () => {
      if (this.closed) return;
      const {
        path,
        description
      } = this;
      debug(`close connection on ${path} (${description.category})`);
      this.closed = true;
      this.encoder.end();
      this.decoder.removeAllListeners('data');
      this.socket.destroy();
      this.emit('close');
    });

    const validate = _MibDescription.MibDescriptionV.decode(_description);

    if (validate.isLeft()) {
      const msg = _PathReporter.PathReporter.report(validate).join('\n');

      debug('<error>', msg);
      throw new TypeError(msg);
    }

    this.description = validate.value;
    this.socket = (0, _net.connect)(_xpipe.default.eq((0, _ipc.getSocketPath)(path)));
    this.socket.pipe(this.decoder);
    this.encoder.pipe(this.socket);
    this.decoder.on('data', this.onDatagram);
    this.socket.once('close', this.close);
    debug(`new connection on ${path} (${_description.category})`);
  }

  sendDatagram(datagram) {
    // debug('write datagram from ', datagram.source.toString());
    const {
      encoder,
      stopWaiting,
      waited,
      closed
    } = this;
    return new Promise((resolve, reject) => {
      this.ready = this.ready.finally(async () => {
        if (closed) return reject(new Error('Closed'));

        if (!encoder.write(datagram)) {
          await new Promise(cb => encoder.once('drain', cb));
        }

        if (!(datagram instanceof _nms.NmsDatagram) || datagram.notReply) {
          return resolve();
        }

        waited.push(new WaitedNmsDatagram(datagram, resolve, reject, stopWaiting));
      });
    });
  }

  ping(address) {
    debug(`ping [${address.toString()}] ${this.path}`);
    const now = Date.now();
    return this.sendDatagram((0, _nms.createNmsRead)(address, VERSION_ID)).then(datagram => {
      return Reflect.getOwnMetadata('timeStamp', datagram) - now;
    }).catch(() => {
      // debug(`ping [${address}] failed ${reson}`);
      return -1;
    });
  }

  findByType(type = MINIHOST_TYPE) {
    debug(`findByType ${type} on ${this.path} (${this.description.category})`);
    const sarp = (0, _sarp.createSarp)(_sarp.SarpQueryType.ByType, [0, 0, 0, type >> 8 & 0xFF, type & 0xFF]);
    return this.sendDatagram(sarp);
  }

  async getVersion(address) {
    const nmsRead = (0, _nms.createNmsRead)(address, VERSION_ID);

    try {
      const {
        value,
        status
      } = await this.sendDatagram(nmsRead);

      if (status !== 0) {
        debug('<error>', status);
        return [];
      }

      const version = value & 0xFFFF;
      const type = value >>> 16;
      return [version, type];
    } catch (err) {
      debug('<error>', err.message || err);
      return [];
    }
  }

}

var _default = NibusConnection;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9uaWJ1cy9OaWJ1c0Nvbm5lY3Rpb24udHMiXSwibmFtZXMiOlsiTUlOSUhPU1RfVFlQRSIsIlZFUlNJT05fSUQiLCJkZWJ1ZyIsIk5JQlVTX1RJTUVPVVQiLCJzZXROaWJ1c1RpbWVvdXQiLCJ0aW1lb3V0IiwiZ2V0TmlidXNUaW1lb3V0IiwiV2FpdGVkTm1zRGF0YWdyYW0iLCJjb25zdHJ1Y3RvciIsInJlcSIsInJlc29sdmUiLCJyZWplY3QiLCJjYWxsYmFjayIsInRpbWVyIiwiY291bnRlciIsInNlcnZpY2UiLCJObXNTZXJ2aWNlVHlwZSIsIlJlYWQiLCJNYXRoIiwiZmxvb3IiLCJubXMiLCJsZW5ndGgiLCJkYXRhZ3JhbXMiLCJUaW1lb3V0RXJyb3IiLCJkZXN0aW5hdGlvbiIsInJlc3RhcnQiLCJzdGVwIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImRhdGFncmFtIiwicHVzaCIsIk5pYnVzQ29ubmVjdGlvbiIsIkV2ZW50RW1pdHRlciIsInBhdGgiLCJkZXNjcmlwdGlvbiIsIk5pYnVzRW5jb2RlciIsIk5pYnVzRGVjb2RlciIsIlByb21pc2UiLCJ3YWl0ZWQiLCJfIiwicmVtb3ZlIiwic2hvd0xvZyIsIk5tc0RhdGFncmFtIiwiaXNSZXNwb25zZSIsInJlc3AiLCJmaW5kIiwiaXRlbSIsImlzUmVzcG9uc2VGb3IiLCJlbWl0IiwiU2FycERhdGFncmFtIiwiSlNPTiIsInN0cmluZ2lmeSIsInRvSlNPTiIsImNsb3NlZCIsImNhdGVnb3J5IiwiZW5jb2RlciIsImVuZCIsImRlY29kZXIiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJzb2NrZXQiLCJkZXN0cm95IiwidmFsaWRhdGUiLCJNaWJEZXNjcmlwdGlvblYiLCJkZWNvZGUiLCJpc0xlZnQiLCJtc2ciLCJQYXRoUmVwb3J0ZXIiLCJyZXBvcnQiLCJqb2luIiwiVHlwZUVycm9yIiwidmFsdWUiLCJ4cGlwZSIsImVxIiwicGlwZSIsIm9uIiwib25EYXRhZ3JhbSIsIm9uY2UiLCJjbG9zZSIsInNlbmREYXRhZ3JhbSIsInN0b3BXYWl0aW5nIiwicmVhZHkiLCJmaW5hbGx5IiwiRXJyb3IiLCJ3cml0ZSIsImNiIiwibm90UmVwbHkiLCJwaW5nIiwiYWRkcmVzcyIsInRvU3RyaW5nIiwibm93IiwiRGF0ZSIsInRoZW4iLCJSZWZsZWN0IiwiZ2V0T3duTWV0YWRhdGEiLCJjYXRjaCIsImZpbmRCeVR5cGUiLCJ0eXBlIiwic2FycCIsIlNhcnBRdWVyeVR5cGUiLCJCeVR5cGUiLCJnZXRWZXJzaW9uIiwibm1zUmVhZCIsInN0YXR1cyIsInZlcnNpb24iLCJlcnIiLCJtZXNzYWdlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFVQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFFQTs7QUFJQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7Ozs7O0FBRU8sTUFBTUEsYUFBYSxHQUFHLE1BQXRCLEMsQ0FDUDs7O0FBQ0EsTUFBTUMsVUFBVSxHQUFHLENBQW5CO0FBRUEsTUFBTUMsS0FBSyxHQUFHLG9CQUFhLGtCQUFiLENBQWQ7QUFDQSxJQUFJQyxhQUFhLEdBQUcsSUFBcEI7O0FBRU8sTUFBTUMsZUFBZSxHQUFJQyxPQUFELElBQXFCO0FBQ2xERixFQUFBQSxhQUFhLEdBQUdFLE9BQWhCO0FBQ0QsQ0FGTTs7OztBQUlBLE1BQU1DLGVBQWUsR0FBRyxNQUFNSCxhQUE5Qjs7OztBQUVQLE1BQU1JLGlCQUFOLENBQXdCO0FBR3RCQyxFQUFBQSxXQUFXLENBQ09DLEdBRFAsRUFFVEMsT0FGUyxFQUdUQyxNQUhTLEVBSVRDLFFBSlMsRUFJb0M7QUFBQTs7QUFBQTs7QUFDN0MsUUFBSUMsS0FBSjtBQUNBLFFBQUlDLE9BQWUsR0FBR0wsR0FBRyxDQUFDTSxPQUFKLEtBQWdCQyx3QkFBZUMsSUFBL0IsR0FDbEIsQ0FEa0IsR0FFbEJDLElBQUksQ0FBQ0MsS0FBTCxDQUFXVixHQUFHLENBQUNXLEdBQUosQ0FBUUMsTUFBUixHQUFpQixDQUE1QixJQUFpQyxDQUZy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QSxLQUFLLENBQUMsU0FBRCxFQUFZb0csTUFBWixDQUFMO0FBQ0EsZUFBTyxFQUFQO0FBQ0Q7O0FBQ0QsWUFBTUMsT0FBTyxHQUFJakMsS0FBRCxHQUFvQixNQUFwQztBQUNBLFlBQU0wQixJQUFJLEdBQUkxQixLQUFELEtBQXNCLEVBQW5DO0FBQ0EsYUFBTyxDQUFDaUMsT0FBRCxFQUFVUCxJQUFWLENBQVA7QUFDRCxLQVRELENBU0UsT0FBT1EsR0FBUCxFQUFZO0FBQ1p0RyxNQUFBQSxLQUFLLENBQUMsU0FBRCxFQUFZc0csR0FBRyxDQUFDQyxPQUFKLElBQWVELEdBQTNCLENBQUw7QUFDQSxhQUFPLEVBQVA7QUFDRDtBQUNGOztBQXZHd0M7O2VBcUg1QnpFLGUiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gT09PIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCB7IFBhdGhSZXBvcnRlciB9IGZyb20gJ2lvLXRzL2xpYi9QYXRoUmVwb3J0ZXInO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IFNvY2tldCwgY29ubmVjdCB9IGZyb20gJ25ldCc7XG5pbXBvcnQgeHBpcGUgZnJvbSAneHBpcGUnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgQWRkcmVzc1BhcmFtIH0gZnJvbSAnLi4vQWRkcmVzcyc7XG5pbXBvcnQgeyBUaW1lb3V0RXJyb3IgfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHsgZ2V0U29ja2V0UGF0aCB9IGZyb20gJy4uL2lwYyc7XG4vLyBpbXBvcnQgeyBkZXZpY2VzIH0gZnJvbSAnLi4vbWliJztcbmltcG9ydCB7XG4gIGNyZWF0ZU5tc1JlYWQsXG4gIE5tc0RhdGFncmFtLFxufSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IE5tc1NlcnZpY2VUeXBlIGZyb20gJy4uL25tcy9ObXNTZXJ2aWNlVHlwZSc7XG5pbXBvcnQgeyBjcmVhdGVTYXJwLCBTYXJwUXVlcnlUeXBlLCBTYXJwRGF0YWdyYW0gfSBmcm9tICcuLi9zYXJwJztcbmltcG9ydCB7IE1pYkRlc2NyaXB0aW9uViwgSU1pYkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vTWliRGVzY3JpcHRpb24nO1xuaW1wb3J0IE5pYnVzRGF0YWdyYW0gZnJvbSAnLi9OaWJ1c0RhdGFncmFtJztcbmltcG9ydCBOaWJ1c0VuY29kZXIgZnJvbSAnLi9OaWJ1c0VuY29kZXInO1xuaW1wb3J0IE5pYnVzRGVjb2RlciBmcm9tICcuL05pYnVzRGVjb2Rlcic7XG5cbmV4cG9ydCBjb25zdCBNSU5JSE9TVF9UWVBFID0gMHhhYmM2O1xuLy8gY29uc3QgRklSTVdBUkVfVkVSU0lPTl9JRCA9IDB4ODU7XG5jb25zdCBWRVJTSU9OX0lEID0gMjtcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOmNvbm5lY3Rpb24nKTtcbmxldCBOSUJVU19USU1FT1VUID0gMTAwMDtcblxuZXhwb3J0IGNvbnN0IHNldE5pYnVzVGltZW91dCA9ICh0aW1lb3V0OiBudW1iZXIpID0+IHtcbiAgTklCVVNfVElNRU9VVCA9IHRpbWVvdXQ7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0TmlidXNUaW1lb3V0ID0gKCkgPT4gTklCVVNfVElNRU9VVDtcblxuY2xhc3MgV2FpdGVkTm1zRGF0YWdyYW0ge1xuICByZWFkb25seSByZXNvbHZlOiAoZGF0YWdyYW06IE5tc0RhdGFncmFtKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSByZXE6IE5tc0RhdGFncmFtLFxuICAgIHJlc29sdmU6IChkYXRhZ3JhbTogTm1zRGF0YWdyYW0gfCBObXNEYXRhZ3JhbVtdKSA9PiB2b2lkLFxuICAgIHJlamVjdDogKHJlYXNvbjogRXJyb3IpID0+IHZvaWQsXG4gICAgY2FsbGJhY2s6IChzZWxmOiBXYWl0ZWRObXNEYXRhZ3JhbSkgPT4gdm9pZCkge1xuICAgIGxldCB0aW1lcjogTm9kZUpTLlRpbWVyO1xuICAgIGxldCBjb3VudGVyOiBudW1iZXIgPSByZXEuc2VydmljZSAhPT0gTm1zU2VydmljZVR5cGUuUmVhZFxuICAgICAgPyAxXG4gICAgICA6IE1hdGguZmxvb3IocmVxLm5tcy5sZW5ndGggLyAzKSArIDE7XG4gICAgY29uc3QgZGF0YWdyYW1zOiBObXNEYXRhZ3JhbVtdID0gW107XG4gICAgY29uc3QgdGltZW91dCA9ICgpID0+IHtcbiAgICAgIGNhbGxiYWNrKHRoaXMpO1xuICAgICAgZGF0YWdyYW1zLmxlbmd0aCA9PT0gMFxuICAgICAgICA/IHJlamVjdChuZXcgVGltZW91dEVycm9yKFxuICAgICAgICBgVGltZW91dCBlcnJvciBvbiAke3JlcS5kZXN0aW5hdGlvbn0gd2hpbGUgJHtObXNTZXJ2aWNlVHlwZVtyZXEuc2VydmljZV19YCkpXG4gICAgICAgIDogcmVzb2x2ZShkYXRhZ3JhbXMpO1xuICAgIH07XG4gICAgY29uc3QgcmVzdGFydCA9IChzdGVwID0gMSkgPT4ge1xuICAgICAgY291bnRlciAtPSBzdGVwO1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIGlmIChjb3VudGVyID4gMCkge1xuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQodGltZW91dCwgcmVxLnRpbWVvdXQgfHwgTklCVVNfVElNRU9VVCk7XG4gICAgICB9IGVsc2UgaWYgKGNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgY2FsbGJhY2sodGhpcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY291bnRlciA9PT0gMDtcbiAgICB9O1xuICAgIHJlc3RhcnQoMCk7XG4gICAgdGhpcy5yZXNvbHZlID0gKGRhdGFncmFtOiBObXNEYXRhZ3JhbSkgPT4ge1xuICAgICAgZGF0YWdyYW1zLnB1c2goZGF0YWdyYW0pO1xuICAgICAgaWYgKHJlc3RhcnQoKSkge1xuICAgICAgICByZXNvbHZlKGRhdGFncmFtcy5sZW5ndGggPiAxID8gZGF0YWdyYW1zIDogZGF0YWdyYW0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cbn1cblxudHlwZSBTYXJwTGlzdG5lciA9IChkYXRhZ3JhbTogU2FycERhdGFncmFtKSA9PiB2b2lkO1xudHlwZSBObXNMaXN0ZW5lciA9IChkYXRhZ3JhbTogTm1zRGF0YWdyYW0pID0+IHZvaWQ7XG5cbmRlY2xhcmUgaW50ZXJmYWNlIE5pYnVzQ29ubmVjdGlvbiB7XG4gIG9uKGV2ZW50OiAnc2FycCcsIGxpc3RlbmVyOiBTYXJwTGlzdG5lcik6IHRoaXM7XG5cbiAgb24oZXZlbnQ6ICdubXMnLCBsaXN0ZW5lcjogTm1zTGlzdGVuZXIpOiB0aGlzO1xuXG4gIG9uY2UoZXZlbnQ6ICdzYXJwJywgbGlzdGVuZXI6IFNhcnBMaXN0bmVyKTogdGhpcztcblxuICBvbmNlKGV2ZW50OiAnbm1zJywgbGlzdGVuZXI6IE5tc0xpc3RlbmVyKTogdGhpcztcblxuICBhZGRMaXN0ZW5lcihldmVudDogJ3NhcnAnLCBsaXN0ZW5lcjogU2FycExpc3RuZXIpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnbm1zJywgbGlzdGVuZXI6IE5tc0xpc3RlbmVyKTogdGhpcztcbn1cblxuY2xhc3MgTmlidXNDb25uZWN0aW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBzb2NrZXQ6IFNvY2tldDtcbiAgcHJpdmF0ZSByZWFkb25seSBlbmNvZGVyID0gbmV3IE5pYnVzRW5jb2RlcigpO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlY29kZXIgPSBuZXcgTmlidXNEZWNvZGVyKCk7XG4gIHByaXZhdGUgcmVhZHkgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgcHJpdmF0ZSBjbG9zZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSB3YWl0ZWQ6IFdhaXRlZE5tc0RhdGFncmFtW10gPSBbXTtcbiAgcHVibGljIGRlc2NyaXB0aW9uOiBJTWliRGVzY3JpcHRpb247XG5cbiAgcHJpdmF0ZSBzdG9wV2FpdGluZyA9ICh3YWl0ZWQ6IFdhaXRlZE5tc0RhdGFncmFtKSA9PiBfLnJlbW92ZSh0aGlzLndhaXRlZCwgd2FpdGVkKTtcblxuICBwcml2YXRlIG9uRGF0YWdyYW0gPSAoZGF0YWdyYW06IE5pYnVzRGF0YWdyYW0pID0+IHtcbiAgICBsZXQgc2hvd0xvZyA9IHRydWU7XG4gICAgaWYgKGRhdGFncmFtIGluc3RhbmNlb2YgTm1zRGF0YWdyYW0pIHtcbiAgICAgIGlmIChkYXRhZ3JhbS5pc1Jlc3BvbnNlKSB7XG4gICAgICAgIGNvbnN0IHJlc3AgPSB0aGlzLndhaXRlZC5maW5kKGl0ZW0gPT4gZGF0YWdyYW0uaXNSZXNwb25zZUZvcihpdGVtLnJlcSkpO1xuICAgICAgICBpZiAocmVzcCkge1xuICAgICAgICAgIHJlc3AucmVzb2x2ZShkYXRhZ3JhbSk7XG4gICAgICAgICAgc2hvd0xvZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmVtaXQoJ25tcycsIGRhdGFncmFtKTtcbiAgICB9IGVsc2UgaWYgKGRhdGFncmFtIGluc3RhbmNlb2YgU2FycERhdGFncmFtKSB7XG4gICAgICB0aGlzLmVtaXQoJ3NhcnAnLCBkYXRhZ3JhbSk7XG4gICAgICBzaG93TG9nID0gZmFsc2U7XG4gICAgfVxuICAgIHNob3dMb2cgJiZcbiAgICBkZWJ1ZyhgZGF0YWdyYW0gcmVjZWl2ZWRgLCBKU09OLnN0cmluZ2lmeShkYXRhZ3JhbS50b0pTT04oKSkpO1xuICB9O1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBwYXRoOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBJTWliRGVzY3JpcHRpb24pIHtcbiAgICBzdXBlcigpO1xuICAgIGNvbnN0IHZhbGlkYXRlID0gTWliRGVzY3JpcHRpb25WLmRlY29kZShkZXNjcmlwdGlvbik7XG4gICAgaWYgKHZhbGlkYXRlLmlzTGVmdCgpKSB7XG4gICAgICBjb25zdCBtc2cgPSBQYXRoUmVwb3J0ZXIucmVwb3J0KHZhbGlkYXRlKS5qb2luKCdcXG4nKTtcbiAgICAgIGRlYnVnKCc8ZXJyb3I+JywgbXNnKTtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IobXNnKTtcbiAgICB9XG4gICAgdGhpcy5kZXNjcmlwdGlvbiA9IHZhbGlkYXRlLnZhbHVlO1xuICAgIHRoaXMuc29ja2V0ID0gY29ubmVjdCh4cGlwZS5lcShnZXRTb2NrZXRQYXRoKHBhdGgpKSk7XG4gICAgdGhpcy5zb2NrZXQucGlwZSh0aGlzLmRlY29kZXIpO1xuICAgIHRoaXMuZW5jb2Rlci5waXBlKHRoaXMuc29ja2V0KTtcbiAgICB0aGlzLmRlY29kZXIub24oJ2RhdGEnLCB0aGlzLm9uRGF0YWdyYW0pO1xuICAgIHRoaXMuc29ja2V0Lm9uY2UoJ2Nsb3NlJywgdGhpcy5jbG9zZSk7XG4gICAgZGVidWcoYG5ldyBjb25uZWN0aW9uIG9uICR7cGF0aH0gKCR7ZGVzY3JpcHRpb24uY2F0ZWdvcnl9KWApO1xuICB9XG5cbiAgcHVibGljIHNlbmREYXRhZ3JhbShkYXRhZ3JhbTogTmlidXNEYXRhZ3JhbSk6IFByb21pc2U8Tm1zRGF0YWdyYW0gfCBObXNEYXRhZ3JhbVtdIHwgdW5kZWZpbmVkPiB7XG4gICAgLy8gZGVidWcoJ3dyaXRlIGRhdGFncmFtIGZyb20gJywgZGF0YWdyYW0uc291cmNlLnRvU3RyaW5nKCkpO1xuICAgIGNvbnN0IHsgZW5jb2Rlciwgc3RvcFdhaXRpbmcsIHdhaXRlZCwgY2xvc2VkIH0gPSB0aGlzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnJlYWR5ID0gdGhpcy5yZWFkeS5maW5hbGx5KGFzeW5jICgpID0+IHtcbiAgICAgICAgaWYgKGNsb3NlZCkgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoJ0Nsb3NlZCcpKTtcbiAgICAgICAgaWYgKCFlbmNvZGVyLndyaXRlKGRhdGFncmFtKSkge1xuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKGNiID0+IGVuY29kZXIub25jZSgnZHJhaW4nLCBjYikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghKGRhdGFncmFtIGluc3RhbmNlb2YgTm1zRGF0YWdyYW0pIHx8IGRhdGFncmFtLm5vdFJlcGx5KSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgICB3YWl0ZWQucHVzaChuZXcgV2FpdGVkTm1zRGF0YWdyYW0oXG4gICAgICAgICAgZGF0YWdyYW0sXG4gICAgICAgICAgcmVzb2x2ZSxcbiAgICAgICAgICByZWplY3QsXG4gICAgICAgICAgc3RvcFdhaXRpbmcsXG4gICAgICAgICkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcGluZyhhZGRyZXNzOiBBZGRyZXNzUGFyYW0pOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGRlYnVnKGBwaW5nIFske2FkZHJlc3MudG9TdHJpbmcoKX1dICR7dGhpcy5wYXRofWApO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgcmV0dXJuIHRoaXMuc2VuZERhdGFncmFtKGNyZWF0ZU5tc1JlYWQoYWRkcmVzcywgVkVSU0lPTl9JRCkpXG4gICAgICAudGhlbigoZGF0YWdyYW0pID0+IHtcbiAgICAgICAgcmV0dXJuIDxudW1iZXI+KFJlZmxlY3QuZ2V0T3duTWV0YWRhdGEoJ3RpbWVTdGFtcCcsIGRhdGFncmFtISkpIC0gbm93O1xuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgIC8vIGRlYnVnKGBwaW5nIFske2FkZHJlc3N9XSBmYWlsZWQgJHtyZXNvbn1gKTtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfSk7XG4gIH1cblxuICBwdWJsaWMgZmluZEJ5VHlwZSh0eXBlOiBudW1iZXIgPSBNSU5JSE9TVF9UWVBFKSB7XG4gICAgZGVidWcoYGZpbmRCeVR5cGUgJHt0eXBlfSBvbiAke3RoaXMucGF0aH0gKCR7dGhpcy5kZXNjcmlwdGlvbi5jYXRlZ29yeX0pYCk7XG4gICAgY29uc3Qgc2FycCA9IGNyZWF0ZVNhcnAoU2FycFF1ZXJ5VHlwZS5CeVR5cGUsIFswLCAwLCAwLCAodHlwZSA+PiA4KSAmIDB4RkYsIHR5cGUgJiAweEZGXSk7XG4gICAgcmV0dXJuIHRoaXMuc2VuZERhdGFncmFtKHNhcnApO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldFZlcnNpb24oYWRkcmVzczogQWRkcmVzc1BhcmFtKTogUHJvbWlzZTxbbnVtYmVyPywgbnVtYmVyP10+IHtcbiAgICBjb25zdCBubXNSZWFkID0gY3JlYXRlTm1zUmVhZChhZGRyZXNzLCBWRVJTSU9OX0lEKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyB2YWx1ZSwgc3RhdHVzIH0gPSBhd2FpdCB0aGlzLnNlbmREYXRhZ3JhbShubXNSZWFkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgICAgZGVidWcoJzxlcnJvcj4nLCBzdGF0dXMpO1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICBjb25zdCB2ZXJzaW9uID0gKHZhbHVlIGFzIG51bWJlcikgJiAweEZGRkY7XG4gICAgICBjb25zdCB0eXBlID0gKHZhbHVlIGFzIG51bWJlcikgPj4+IDE2O1xuICAgICAgcmV0dXJuIFt2ZXJzaW9uLCB0eXBlXTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGRlYnVnKCc8ZXJyb3I+JywgZXJyLm1lc3NhZ2UgfHwgZXJyKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2xvc2UgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMuY2xvc2VkKSByZXR1cm47XG4gICAgY29uc3QgeyBwYXRoLCBkZXNjcmlwdGlvbiB9ID0gdGhpcztcbiAgICBkZWJ1ZyhgY2xvc2UgY29ubmVjdGlvbiBvbiAke3BhdGh9ICgke2Rlc2NyaXB0aW9uLmNhdGVnb3J5fSlgKTtcbiAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xuICAgIHRoaXMuZGVjb2Rlci5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2RhdGEnKTtcbiAgICB0aGlzLnNvY2tldC5kZXN0cm95KCk7XG4gICAgdGhpcy5lbWl0KCdjbG9zZScpO1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBOaWJ1c0Nvbm5lY3Rpb247XG4iXX0=