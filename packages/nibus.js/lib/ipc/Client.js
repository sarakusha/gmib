"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _net = require("net");

var _PathReporter = require("io-ts/lib/PathReporter");

var _xpipe = _interopRequireDefault(require("xpipe"));

var _debug = _interopRequireDefault(require("debug"));

var _events = require("./events");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:IPCClient');

class IPCClient extends _net.Socket {
  constructor(options) {
    super(options);

    _defineProperty(this, "parseEvents", data => {
      const result = _events.EventFromString.decode(data.toString());

      if (result.isLeft()) {
        debug('<error>:', _PathReporter.PathReporter.report(result));
        return;
      }

      const {
        value: {
          event,
          args
        }
      } = result;
      this.emit(event, ...args);
    });

    this.on('data', this.parseEvents);
  }

  send(event, ...args) {
    const data = {
      event,
      args
    };
    return new Promise(resolve => this.write(JSON.stringify(data), () => resolve()));
  }

  static connect(path, connectionListener) {
    const client = new IPCClient();
    return client.connect(_xpipe.default.eq(path), connectionListener);
  }

}

exports.default = IPCClient;