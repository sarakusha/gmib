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
    this.serial = new _serialport.default(path, { ...portOptions,
      baudRate: description.baudRate || 115200,
      parity: description.parity || portOptions.parity
    });
    this.serial.on('close', this.close);
    this.server = new _Server.default(_nibus.ipc.getSocketPath(path), true);
    this.server.pipe(this.serial);
    this.serial.pipe(this.server);
    debug(`new connection on ${path} (${description.category})`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGMvU2VyaWFsVGVlLnRzIl0sIm5hbWVzIjpbImRlYnVnIiwicG9ydE9wdGlvbnMiLCJiYXVkUmF0ZSIsImRhdGFCaXRzIiwicGFyaXR5Iiwic3RvcEJpdHMiLCJTZXJpYWxUZWUiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsInBvcnRJbmZvIiwiZGVzY3JpcHRpb24iLCJjbG9zZWQiLCJzZXJpYWwiLCJzZXJ2ZXIiLCJpc09wZW4iLCJwYXRoIiwiY2xvc2UiLCJlbWl0IiwiY29tTmFtZSIsIlNlcmlhbFBvcnQiLCJvbiIsIlNlcnZlciIsImlwYyIsImdldFNvY2tldFBhdGgiLCJwaXBlIiwiY2F0ZWdvcnkiLCJzZXRMb2dnZXIiLCJsb2dnZXIiLCJvZmYiLCJ0b0pTT04iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7QUFJQSxNQUFNQSxLQUFLLEdBQUcsb0JBQWEsa0JBQWIsQ0FBZDtBQUNBLE1BQU1DLFdBQXdCLEdBQUc7QUFDL0JDLEVBQUFBLFFBQVEsRUFBRSxNQURxQjtBQUUvQkMsRUFBQUEsUUFBUSxFQUFFLENBRnFCO0FBRy9CQyxFQUFBQSxNQUFNLEVBQUUsTUFIdUI7QUFJL0JDLEVBQUFBLFFBQVEsRUFBRTtBQUpxQixDQUFqQzs7QUFXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFZSxNQUFNQyxTQUFOLFNBQXdCQyxvQkFBeEIsQ0FBcUM7QUFNbERDLEVBQUFBLFdBQVcsQ0FBaUJDLFFBQWpCLEVBQXVEQyxXQUF2RCxFQUFxRjtBQUM5RjtBQUQ4RjtBQUFBOztBQUFBOztBQUFBLG9DQUovRSxLQUkrRTs7QUFBQTs7QUFBQSxvQ0FGMUQsSUFFMEQ7O0FBQUEsbUNBc0JqRixNQUFNO0FBQ25CLFVBQUksS0FBS0MsTUFBVCxFQUFpQjtBQUNqQixZQUFNO0FBQUVDLFFBQUFBLE1BQUY7QUFBVUMsUUFBQUE7QUFBVixVQUFxQixJQUEzQjs7QUFDQSxVQUFJRCxNQUFNLENBQUNFLE1BQVgsRUFBbUI7QUFDakJkLFFBQUFBLEtBQUssQ0FBQyxjQUFELEVBQWlCWSxNQUFNLENBQUNHLElBQXhCLENBQUw7QUFDQUgsUUFBQUEsTUFBTSxDQUFDSSxLQUFQO0FBQ0Q7O0FBQ0RILE1BQUFBLE1BQU0sQ0FBQ0csS0FBUDtBQUNBLFdBQUtMLE1BQUwsR0FBYyxJQUFkO0FBQ0EsV0FBS00sSUFBTCxDQUFVLE9BQVYsRUFBbUIsS0FBS1IsUUFBTCxDQUFjUyxPQUFqQztBQUNELEtBaEMrRjs7QUFFOUYsVUFBTTtBQUFFQSxNQUFBQSxPQUFPLEVBQUVIO0FBQVgsUUFBb0JOLFFBQTFCO0FBQ0EsU0FBS0csTUFBTCxHQUFjLElBQUlPLG1CQUFKLENBQ1pKLElBRFksRUFFWixFQUNFLEdBQUdkLFdBREw7QUFFRUMsTUFBQUEsUUFBUSxFQUFFUSxXQUFXLENBQUNSLFFBQVosSUFBd0IsTUFGcEM7QUFHRUUsTUFBQUEsTUFBTSxFQUFFTSxXQUFXLENBQUNOLE1BQVosSUFBc0JILFdBQVcsQ0FBQ0c7QUFINUMsS0FGWSxDQUFkO0FBUUEsU0FBS1EsTUFBTCxDQUFZUSxFQUFaLENBQWUsT0FBZixFQUF3QixLQUFLSixLQUE3QjtBQUNBLFNBQUtILE1BQUwsR0FBYyxJQUFJUSxlQUFKLENBQVdDLFdBQUlDLGFBQUosQ0FBa0JSLElBQWxCLENBQVgsRUFBb0MsSUFBcEMsQ0FBZDtBQUNBLFNBQUtGLE1BQUwsQ0FBWVcsSUFBWixDQUFpQixLQUFLWixNQUF0QjtBQUNBLFNBQUtBLE1BQUwsQ0FBWVksSUFBWixDQUFpQixLQUFLWCxNQUF0QjtBQUNBYixJQUFBQSxLQUFLLENBQUUscUJBQW9CZSxJQUFLLEtBQUlMLFdBQVcsQ0FBQ2UsUUFBUyxHQUFwRCxDQUFMO0FBQ0Q7O0FBRUQsTUFBV1YsSUFBWCxHQUFrQjtBQUNoQixXQUFPLEtBQUtGLE1BQUwsQ0FBWUUsSUFBbkI7QUFDRDs7QUFjTVcsRUFBQUEsU0FBUCxDQUFpQkMsTUFBakIsRUFBOEM7QUFDNUMsUUFBSSxLQUFLQSxNQUFULEVBQWlCO0FBQ2YsV0FBS2QsTUFBTCxDQUFZZSxHQUFaLENBQWdCLEtBQWhCLEVBQXVCLEtBQUtELE1BQTVCO0FBQ0Q7O0FBQ0QsU0FBS0EsTUFBTCxHQUFjQSxNQUFkOztBQUNBLFFBQUksS0FBS0EsTUFBVCxFQUFpQjtBQUNmLFdBQUtkLE1BQUwsQ0FBWU8sRUFBWixDQUFlLEtBQWYsRUFBc0IsS0FBS08sTUFBM0I7QUFDRDtBQUNGOztBQUVERSxFQUFBQSxNQUFNLEdBQUc7QUFDUCxVQUFNO0FBQUVwQixNQUFBQSxRQUFGO0FBQVlDLE1BQUFBO0FBQVosUUFBNEIsSUFBbEM7QUFDQSxXQUFPO0FBQ0xELE1BQUFBLFFBREs7QUFFTEMsTUFBQUE7QUFGSyxLQUFQO0FBSUQ7O0FBeERpRCIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgU2VyaWFsUG9ydCwgeyBPcGVuT3B0aW9ucyB9IGZyb20gJ3NlcmlhbHBvcnQnO1xuaW1wb3J0IGRlYnVnRmFjdG9yeSBmcm9tICdkZWJ1Zyc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgaXBjIH0gZnJvbSAnQG5hdGEvbmlidXMuanMtY2xpZW50Lyc7XG5pbXBvcnQgU2VydmVyLCB7IERpcmVjdGlvbiB9IGZyb20gJy4vU2VydmVyJztcbmltcG9ydCB7IElLbm93blBvcnQgfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvbGliL3Nlc3Npb24nO1xuaW1wb3J0IHsgSU1pYkRlc2NyaXB0aW9uIH0gZnJvbSAnQG5hdGEvbmlidXMuanMtY2xpZW50L2xpYi9NaWJEZXNjcmlwdGlvbic7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpzZXJpYWwtdGVlJyk7XG5jb25zdCBwb3J0T3B0aW9uczogT3Blbk9wdGlvbnMgPSB7XG4gIGJhdWRSYXRlOiAxMTUyMDAsXG4gIGRhdGFCaXRzOiA4LFxuICBwYXJpdHk6ICdub25lJyxcbiAgc3RvcEJpdHM6IDEsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlcmlhbExvZ2dlciB7XG4gIChkYXRhOiBCdWZmZXIsIGRpcjogRGlyZWN0aW9uKTogdm9pZDtcbn1cblxuLy8gZGVjbGFyZSBtb2R1bGUgc2VyaWFscG9ydCB7XG4vLyAgIGludGVyZmFjZSBTZXJpYWxQb3J0IHtcbi8vICAgICB3cml0ZShcbi8vICAgICAgIGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIsXG4vLyAgICAgICBjYWxsYmFjaz86IChlcnJvcjogYW55LCBieXRlc1dyaXR0ZW46IG51bWJlcikgPT4gdm9pZCk6IGJvb2xlYW47XG4vLyAgICAgd3JpdGUoXG4vLyAgICAgICBidWZmZXI6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIsXG4vLyAgICAgICBlbmNvZGluZz86ICdhc2NpaScgfCAndXRmOCcgfCAndXRmMTZsZScgfCAndWNzMicgfCAnYmFzZTY0JyB8ICdiaW5hcnknIHwgJ2hleCcsXG4vLyAgICAgICBjYWxsYmFjaz86IChlcnJvcjogYW55LCBieXRlc1dyaXR0ZW46IG51bWJlcikgPT4gdm9pZCk6IGJvb2xlYW47XG4vLyAgICAgdGVzdDogKCkgPT4gdm9pZDtcbi8vICAgfVxuLy8gfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTZXJpYWxUZWUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHNlcmlhbDogU2VyaWFsUG9ydDtcbiAgcHJpdmF0ZSBjbG9zZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSBzZXJ2ZXI6IFNlcnZlcjtcbiAgcHJpdmF0ZSBsb2dnZXI6IFNlcmlhbExvZ2dlciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBwb3J0SW5mbzogSUtub3duUG9ydCwgcHVibGljIHJlYWRvbmx5IGRlc2NyaXB0aW9uOiBJTWliRGVzY3JpcHRpb24pIHtcbiAgICBzdXBlcigpO1xuICAgIGNvbnN0IHsgY29tTmFtZTogcGF0aCB9ID0gcG9ydEluZm87XG4gICAgdGhpcy5zZXJpYWwgPSBuZXcgU2VyaWFsUG9ydChcbiAgICAgIHBhdGgsXG4gICAgICB7XG4gICAgICAgIC4uLnBvcnRPcHRpb25zLFxuICAgICAgICBiYXVkUmF0ZTogZGVzY3JpcHRpb24uYmF1ZFJhdGUgfHwgMTE1MjAwLFxuICAgICAgICBwYXJpdHk6IGRlc2NyaXB0aW9uLnBhcml0eSB8fCBwb3J0T3B0aW9ucy5wYXJpdHksXG4gICAgICB9LFxuICAgICk7XG4gICAgdGhpcy5zZXJpYWwub24oJ2Nsb3NlJywgdGhpcy5jbG9zZSk7XG4gICAgdGhpcy5zZXJ2ZXIgPSBuZXcgU2VydmVyKGlwYy5nZXRTb2NrZXRQYXRoKHBhdGgpLCB0cnVlKTtcbiAgICB0aGlzLnNlcnZlci5waXBlKHRoaXMuc2VyaWFsKTtcbiAgICB0aGlzLnNlcmlhbC5waXBlKHRoaXMuc2VydmVyKTtcbiAgICBkZWJ1ZyhgbmV3IGNvbm5lY3Rpb24gb24gJHtwYXRofSAoJHtkZXNjcmlwdGlvbi5jYXRlZ29yeX0pYCk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IHBhdGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VydmVyLnBhdGg7XG4gIH1cblxuICBwdWJsaWMgY2xvc2UgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMuY2xvc2VkKSByZXR1cm47XG4gICAgY29uc3QgeyBzZXJpYWwsIHNlcnZlciB9ID0gdGhpcztcbiAgICBpZiAoc2VyaWFsLmlzT3Blbikge1xuICAgICAgZGVidWcoJ2Nsb3NlIHNlcmlhbCcsIHNlcmlhbC5wYXRoKTtcbiAgICAgIHNlcmlhbC5jbG9zZSgpO1xuICAgIH1cbiAgICBzZXJ2ZXIuY2xvc2UoKTtcbiAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgdGhpcy5lbWl0KCdjbG9zZScsIHRoaXMucG9ydEluZm8uY29tTmFtZSk7XG4gIH07XG5cbiAgcHVibGljIHNldExvZ2dlcihsb2dnZXI6IFNlcmlhbExvZ2dlciB8IG51bGwpIHtcbiAgICBpZiAodGhpcy5sb2dnZXIpIHtcbiAgICAgIHRoaXMuc2VydmVyLm9mZigncmF3JywgdGhpcy5sb2dnZXIpO1xuICAgIH1cbiAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICBpZiAodGhpcy5sb2dnZXIpIHtcbiAgICAgIHRoaXMuc2VydmVyLm9uKCdyYXcnLCB0aGlzLmxvZ2dlcik7XG4gICAgfVxuICB9XG5cbiAgdG9KU09OKCkge1xuICAgIGNvbnN0IHsgcG9ydEluZm8sIGRlc2NyaXB0aW9uIH0gPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBwb3J0SW5mbyxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgIH07XG4gIH1cbn1cbiJdfQ==