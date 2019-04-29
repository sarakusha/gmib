"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _serialport = _interopRequireDefault(require("serialport"));

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _nibus = require("@nata/nibus.js-client/");

var _Server = _interopRequireDefault(require("./Server"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:serial-tee');
const portOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
};

// declare module serialport {
//   interface SerialPort {
//     write(
//       data: string | Uint8Array | Buffer,
//       callback?: (error: any, bytesWritten: number) => void): boolean;
//     write(
//       buffer: string | Uint8Array | Buffer,
//       encoding?: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'binary' | 'hex',
//       callback?: (error: any, bytesWritten: number) => void): boolean;
//     test: () => void;
//   }
// }
class SerialTee extends _events.EventEmitter {
  constructor(portInfo, description) {
    super();
    this.portInfo = portInfo;
    this.description = description;

    _defineProperty(this, "serial", void 0);

    _defineProperty(this, "closed", false);

    _defineProperty(this, "server", void 0);

    _defineProperty(this, "logger", null);

    _defineProperty(this, "close", () => {
      if (this.closed) return;
      const {
        serial,
        server
      } = this;

      if (serial.isOpen) {
        debug('close serial', serial.path);
        serial.close();
      }

      server.close();
      this.closed = true;
      this.emit('close', this.portInfo.comName);
    });

    const {
      comName: path
    } = portInfo;
    const win32 = process.platform === 'win32' && description.win32 || {};
    this.serial = new _serialport.default(path, { ...portOptions,
      baudRate: description.baudRate || 115200,
      parity: win32.parity || description.parity || portOptions.parity
    });
    this.serial.on('close', this.close);
    this.server = new _Server.default(_nibus.ipc.getSocketPath(path), true);
    this.server.pipe(this.serial);
    this.serial.pipe(this.server);
    debug(`new connection on ${path} baud: ${this.serial.baudRate} (${description.category})`);
  }

  get path() {
    return this.server.path;
  }

  setLogger(logger) {
    if (this.logger) {
      this.server.off('raw', this.logger);
    }

    this.logger = logger;

    if (this.logger) {
      this.server.on('raw', this.logger);
    }
  }

  toJSON() {
    const {
      portInfo,
      description
    } = this;
    return {
      portInfo,
      description
    };
  }

}

exports.default = SerialTee;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGMvU2VyaWFsVGVlLnRzIl0sIm5hbWVzIjpbImRlYnVnIiwicG9ydE9wdGlvbnMiLCJiYXVkUmF0ZSIsImRhdGFCaXRzIiwicGFyaXR5Iiwic3RvcEJpdHMiLCJTZXJpYWxUZWUiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsInBvcnRJbmZvIiwiZGVzY3JpcHRpb24iLCJjbG9zZWQiLCJzZXJpYWwiLCJzZXJ2ZXIiLCJpc09wZW4iLCJwYXRoIiwiY2xvc2UiLCJlbWl0IiwiY29tTmFtZSIsIndpbjMyIiwicHJvY2VzcyIsInBsYXRmb3JtIiwiU2VyaWFsUG9ydCIsIm9uIiwiU2VydmVyIiwiaXBjIiwiZ2V0U29ja2V0UGF0aCIsInBpcGUiLCJjYXRlZ29yeSIsInNldExvZ2dlciIsImxvZ2dlciIsIm9mZiIsInRvSlNPTiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7OztBQUlBLE1BQU1BLEtBQUssR0FBRyxvQkFBYSxrQkFBYixDQUFkO0FBQ0EsTUFBTUMsV0FBd0IsR0FBRztBQUMvQkMsRUFBQUEsUUFBUSxFQUFFLE1BRHFCO0FBRS9CQyxFQUFBQSxRQUFRLEVBQUUsQ0FGcUI7QUFHL0JDLEVBQUFBLE1BQU0sRUFBRSxNQUh1QjtBQUkvQkMsRUFBQUEsUUFBUSxFQUFFO0FBSnFCLENBQWpDOztBQVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVlLE1BQU1DLFNBQU4sU0FBd0JDLG9CQUF4QixDQUFxQztBQU1sREMsRUFBQUEsV0FBVyxDQUFpQkMsUUFBakIsRUFBdURDLFdBQXZELEVBQXFGO0FBQzlGO0FBRDhGO0FBQUE7O0FBQUE7O0FBQUEsb0NBSi9FLEtBSStFOztBQUFBOztBQUFBLG9DQUYxRCxJQUUwRDs7QUFBQSxtQ0F1QmpGLE1BQU07QUFDbkIsVUFBSSxLQUFLQyxNQUFULEVBQWlCO0FBQ2pCLFlBQU07QUFBRUMsUUFBQUEsTUFBRjtBQUFVQyxRQUFBQTtBQUFWLFVBQXFCLElBQTNCOztBQUNBLFVBQUlELE1BQU0sQ0FBQ0UsTUFBWCxFQUFtQjtBQUNqQmQsUUFBQUEsS0FBSyxDQUFDLGNBQUQsRUFBaUJZLE1BQU0sQ0FBQ0csSUFBeEIsQ0FBTDtBQUNBSCxRQUFBQSxNQUFNLENBQUNJLEtBQVA7QUFDRDs7QUFDREgsTUFBQUEsTUFBTSxDQUFDRyxLQUFQO0FBQ0EsV0FBS0wsTUFBTCxHQUFjLElBQWQ7QUFDQSxXQUFLTSxJQUFMLENBQVUsT0FBVixFQUFtQixLQUFLUixRQUFMLENBQWNTLE9BQWpDO0FBQ0QsS0FqQytGOztBQUU5RixVQUFNO0FBQUVBLE1BQUFBLE9BQU8sRUFBRUg7QUFBWCxRQUFvQk4sUUFBMUI7QUFDQSxVQUFNVSxLQUFLLEdBQUdDLE9BQU8sQ0FBQ0MsUUFBUixLQUFxQixPQUFyQixJQUFnQ1gsV0FBVyxDQUFDUyxLQUE1QyxJQUFxRCxFQUFuRTtBQUNBLFNBQUtQLE1BQUwsR0FBYyxJQUFJVSxtQkFBSixDQUNaUCxJQURZLEVBRVosRUFDRSxHQUFHZCxXQURMO0FBRUVDLE1BQUFBLFFBQVEsRUFBRVEsV0FBVyxDQUFDUixRQUFaLElBQXdCLE1BRnBDO0FBR0VFLE1BQUFBLE1BQU0sRUFBRWUsS0FBSyxDQUFDZixNQUFOLElBQWdCTSxXQUFXLENBQUNOLE1BQTVCLElBQXNDSCxXQUFXLENBQUNHO0FBSDVELEtBRlksQ0FBZDtBQVFBLFNBQUtRLE1BQUwsQ0FBWVcsRUFBWixDQUFlLE9BQWYsRUFBd0IsS0FBS1AsS0FBN0I7QUFDQSxTQUFLSCxNQUFMLEdBQWMsSUFBSVcsZUFBSixDQUFXQyxXQUFJQyxhQUFKLENBQWtCWCxJQUFsQixDQUFYLEVBQW9DLElBQXBDLENBQWQ7QUFDQSxTQUFLRixNQUFMLENBQVljLElBQVosQ0FBaUIsS0FBS2YsTUFBdEI7QUFDQSxTQUFLQSxNQUFMLENBQVllLElBQVosQ0FBaUIsS0FBS2QsTUFBdEI7QUFDQWIsSUFBQUEsS0FBSyxDQUFFLHFCQUFvQmUsSUFBSyxVQUFTLEtBQUtILE1BQUwsQ0FBWVYsUUFBUyxLQUFJUSxXQUFXLENBQUNrQixRQUFTLEdBQWxGLENBQUw7QUFDRDs7QUFFRCxNQUFXYixJQUFYLEdBQWtCO0FBQ2hCLFdBQU8sS0FBS0YsTUFBTCxDQUFZRSxJQUFuQjtBQUNEOztBQWNNYyxFQUFBQSxTQUFQLENBQWlCQyxNQUFqQixFQUE4QztBQUM1QyxRQUFJLEtBQUtBLE1BQVQsRUFBaUI7QUFDZixXQUFLakIsTUFBTCxDQUFZa0IsR0FBWixDQUFnQixLQUFoQixFQUF1QixLQUFLRCxNQUE1QjtBQUNEOztBQUNELFNBQUtBLE1BQUwsR0FBY0EsTUFBZDs7QUFDQSxRQUFJLEtBQUtBLE1BQVQsRUFBaUI7QUFDZixXQUFLakIsTUFBTCxDQUFZVSxFQUFaLENBQWUsS0FBZixFQUFzQixLQUFLTyxNQUEzQjtBQUNEO0FBQ0Y7O0FBRURFLEVBQUFBLE1BQU0sR0FBRztBQUNQLFVBQU07QUFBRXZCLE1BQUFBLFFBQUY7QUFBWUMsTUFBQUE7QUFBWixRQUE0QixJQUFsQztBQUNBLFdBQU87QUFDTEQsTUFBQUEsUUFESztBQUVMQyxNQUFBQTtBQUZLLEtBQVA7QUFJRDs7QUF6RGlEIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBTZXJpYWxQb3J0LCB7IE9wZW5PcHRpb25zIH0gZnJvbSAnc2VyaWFscG9ydCc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBpcGMgfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvJztcbmltcG9ydCBTZXJ2ZXIsIHsgRGlyZWN0aW9uIH0gZnJvbSAnLi9TZXJ2ZXInO1xuaW1wb3J0IHsgSUtub3duUG9ydCB9IGZyb20gJ0BuYXRhL25pYnVzLmpzLWNsaWVudC9saWIvc2Vzc2lvbic7XG5pbXBvcnQgeyBJTWliRGVzY3JpcHRpb24gfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvbGliL01pYkRlc2NyaXB0aW9uJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOnNlcmlhbC10ZWUnKTtcbmNvbnN0IHBvcnRPcHRpb25zOiBPcGVuT3B0aW9ucyA9IHtcbiAgYmF1ZFJhdGU6IDExNTIwMCxcbiAgZGF0YUJpdHM6IDgsXG4gIHBhcml0eTogJ25vbmUnLFxuICBzdG9wQml0czogMSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsTG9nZ2VyIHtcbiAgKGRhdGE6IEJ1ZmZlciwgZGlyOiBEaXJlY3Rpb24pOiB2b2lkO1xufVxuXG4vLyBkZWNsYXJlIG1vZHVsZSBzZXJpYWxwb3J0IHtcbi8vICAgaW50ZXJmYWNlIFNlcmlhbFBvcnQge1xuLy8gICAgIHdyaXRlKFxuLy8gICAgICAgZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSB8IEJ1ZmZlcixcbi8vICAgICAgIGNhbGxiYWNrPzogKGVycm9yOiBhbnksIGJ5dGVzV3JpdHRlbjogbnVtYmVyKSA9PiB2b2lkKTogYm9vbGVhbjtcbi8vICAgICB3cml0ZShcbi8vICAgICAgIGJ1ZmZlcjogc3RyaW5nIHwgVWludDhBcnJheSB8IEJ1ZmZlcixcbi8vICAgICAgIGVuY29kaW5nPzogJ2FzY2lpJyB8ICd1dGY4JyB8ICd1dGYxNmxlJyB8ICd1Y3MyJyB8ICdiYXNlNjQnIHwgJ2JpbmFyeScgfCAnaGV4Jyxcbi8vICAgICAgIGNhbGxiYWNrPzogKGVycm9yOiBhbnksIGJ5dGVzV3JpdHRlbjogbnVtYmVyKSA9PiB2b2lkKTogYm9vbGVhbjtcbi8vICAgICB0ZXN0OiAoKSA9PiB2b2lkO1xuLy8gICB9XG4vLyB9XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNlcmlhbFRlZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgc2VyaWFsOiBTZXJpYWxQb3J0O1xuICBwcml2YXRlIGNsb3NlZCA9IGZhbHNlO1xuICBwcml2YXRlIHJlYWRvbmx5IHNlcnZlcjogU2VydmVyO1xuICBwcml2YXRlIGxvZ2dlcjogU2VyaWFsTG9nZ2VyIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHBvcnRJbmZvOiBJS25vd25Qb3J0LCBwdWJsaWMgcmVhZG9ubHkgZGVzY3JpcHRpb246IElNaWJEZXNjcmlwdGlvbikge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgeyBjb21OYW1lOiBwYXRoIH0gPSBwb3J0SW5mbztcbiAgICBjb25zdCB3aW4zMiA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgJiYgZGVzY3JpcHRpb24ud2luMzIgfHwge307XG4gICAgdGhpcy5zZXJpYWwgPSBuZXcgU2VyaWFsUG9ydChcbiAgICAgIHBhdGgsXG4gICAgICB7XG4gICAgICAgIC4uLnBvcnRPcHRpb25zLFxuICAgICAgICBiYXVkUmF0ZTogZGVzY3JpcHRpb24uYmF1ZFJhdGUgfHwgMTE1MjAwLFxuICAgICAgICBwYXJpdHk6IHdpbjMyLnBhcml0eSB8fCBkZXNjcmlwdGlvbi5wYXJpdHkgfHwgcG9ydE9wdGlvbnMucGFyaXR5LFxuICAgICAgfSxcbiAgICApO1xuICAgIHRoaXMuc2VyaWFsLm9uKCdjbG9zZScsIHRoaXMuY2xvc2UpO1xuICAgIHRoaXMuc2VydmVyID0gbmV3IFNlcnZlcihpcGMuZ2V0U29ja2V0UGF0aChwYXRoKSwgdHJ1ZSk7XG4gICAgdGhpcy5zZXJ2ZXIucGlwZSh0aGlzLnNlcmlhbCk7XG4gICAgdGhpcy5zZXJpYWwucGlwZSh0aGlzLnNlcnZlcik7XG4gICAgZGVidWcoYG5ldyBjb25uZWN0aW9uIG9uICR7cGF0aH0gYmF1ZDogJHt0aGlzLnNlcmlhbC5iYXVkUmF0ZX0gKCR7ZGVzY3JpcHRpb24uY2F0ZWdvcnl9KWApO1xuICB9XG5cbiAgcHVibGljIGdldCBwYXRoKCkge1xuICAgIHJldHVybiB0aGlzLnNlcnZlci5wYXRoO1xuICB9XG5cbiAgcHVibGljIGNsb3NlID0gKCkgPT4ge1xuICAgIGlmICh0aGlzLmNsb3NlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHsgc2VyaWFsLCBzZXJ2ZXIgfSA9IHRoaXM7XG4gICAgaWYgKHNlcmlhbC5pc09wZW4pIHtcbiAgICAgIGRlYnVnKCdjbG9zZSBzZXJpYWwnLCBzZXJpYWwucGF0aCk7XG4gICAgICBzZXJpYWwuY2xvc2UoKTtcbiAgICB9XG4gICAgc2VydmVyLmNsb3NlKCk7XG4gICAgdGhpcy5jbG9zZWQgPSB0cnVlO1xuICAgIHRoaXMuZW1pdCgnY2xvc2UnLCB0aGlzLnBvcnRJbmZvLmNvbU5hbWUpO1xuICB9O1xuXG4gIHB1YmxpYyBzZXRMb2dnZXIobG9nZ2VyOiBTZXJpYWxMb2dnZXIgfCBudWxsKSB7XG4gICAgaWYgKHRoaXMubG9nZ2VyKSB7XG4gICAgICB0aGlzLnNlcnZlci5vZmYoJ3JhdycsIHRoaXMubG9nZ2VyKTtcbiAgICB9XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXI7XG4gICAgaWYgKHRoaXMubG9nZ2VyKSB7XG4gICAgICB0aGlzLnNlcnZlci5vbigncmF3JywgdGhpcy5sb2dnZXIpO1xuICAgIH1cbiAgfVxuXG4gIHRvSlNPTigpIHtcbiAgICBjb25zdCB7IHBvcnRJbmZvLCBkZXNjcmlwdGlvbiB9ID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgcG9ydEluZm8sXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICB9O1xuICB9XG59XG4iXX0=