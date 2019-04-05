"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Direction = void 0;

require("source-map-support/register");

var _net = _interopRequireWildcard(require("net"));

var _stream = require("stream");

var _debug = _interopRequireDefault(require("debug"));

var _fs = _interopRequireDefault(require("fs"));

var _xpipe = _interopRequireDefault(require("xpipe"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('nibus:IPCServer');

const noop = () => {};

let Direction;
exports.Direction = Direction;

(function (Direction) {
  Direction[Direction["in"] = 0] = "in";
  Direction[Direction["out"] = 1] = "out";
})(Direction || (exports.Direction = Direction = {}));

class IPCServer extends _stream.Duplex {
  constructor(_path, raw = false) {
    super();
    this.raw = raw;

    _defineProperty(this, "server", void 0);

    _defineProperty(this, "clients", void 0);

    _defineProperty(this, "closed", false);

    _defineProperty(this, "reading", false);

    _defineProperty(this, "connectionHandler", socket => {
      this.emit('connection', socket);
      this.clients.push(socket);
      socket.once('error', this.clientErrorHandler.bind(this, socket)).on('data', this.clientDataHandler.bind(this, socket)).once('close', () => this.removeClient(socket));
      debug('new connection on', this.path, this.clients.length);
    });

    _defineProperty(this, "errorHandler", err => {
      if (err.code === 'EADDRINUSE') {
        const check = _net.default.connect(_xpipe.default.eq(this.path), () => {
          debug('Server running, giving up...');
          process.exit();
        });

        check.once('error', e => {
          if (e.code === 'ECONNREFUSED') {
            _fs.default.unlinkSync(_xpipe.default.eq(this.path));

            this.server.listen(_xpipe.default.eq(this.path), () => {
              debug('restart', this.server.address());
            });
          }
        });
      } else {
        throw err;
      }
    });

    _defineProperty(this, "close", () => {
      if (this.closed) return;
      const path = this.server.address();
      this.clients.forEach(client => client.destroy());
      this.clients.length = 0;
      this.server.close();
      this.raw && this.push(null);
      this.closed = true;
      debug(`${path} closed`);
    });

    this.clients = [];
    this.server = new _net.Server();
    this.server = _net.default.createServer(this.connectionHandler).on('error', this.errorHandler).on('close', this.close).listen(_xpipe.default.eq(_path), () => {
      debug('listening on', this.server.address());
    });
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  clientErrorHandler(client, err) {
    debug('error on client', err.message);
    this.emit('client:error', client, err);
    this.removeClient(client);
  }

  clientDataHandler(client, data) {
    // if (this.raie) {
    //   debug(this.path, printBuffer(data));
    // }
    if (this.reading) {
      this.reading = this.push(data);
    }

    if (this.raw) {
      return this.emit('raw', data, Direction.in);
    }

    debug('data from', client.remoteAddress, data.toString());
    const {
      event,
      args
    } = JSON.parse(data.toString());
    this.emit(`client:${event}`, client, ...args);
  }

  removeClient(client) {
    const index = this.clients.findIndex(item => item === client);

    if (index !== -1) {
      this.clients.splice(index, 1);
    }

    client.destroy();
    debug('destroy connection on', this.path, this.clients.length);
  } // tslint:disable-next-line:function-name


  _write(chunk, encoding, callback) {
    this.emit('raw', chunk, Direction.out);
    this.clients.forEach(client => client.write(chunk, encoding, noop));
    callback();
  } // tslint:disable-next-line:function-name


  _read(size) {
    this.reading = true;
  }

  get path() {
    return (this.server.address() || '').toString();
  }

  send(client, event, ...args) {
    if (this.closed) {
      return Promise.reject(new Error('Server is closed'));
    }

    const data = {
      event,
      args
    };
    return new Promise(resolve => client.write(JSON.stringify(data), () => resolve()));
  }

  broadcast(event, ...args) {
    return Promise.all(this.clients.map(client => this.send(client, event, ...args))).then(() => {});
  }

}

var _default = IPCServer;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGMvU2VydmVyLnRzIl0sIm5hbWVzIjpbImRlYnVnIiwibm9vcCIsIkRpcmVjdGlvbiIsIklQQ1NlcnZlciIsIkR1cGxleCIsImNvbnN0cnVjdG9yIiwicGF0aCIsInJhdyIsInNvY2tldCIsImVtaXQiLCJjbGllbnRzIiwicHVzaCIsIm9uY2UiLCJjbGllbnRFcnJvckhhbmRsZXIiLCJiaW5kIiwib24iLCJjbGllbnREYXRhSGFuZGxlciIsInJlbW92ZUNsaWVudCIsImxlbmd0aCIsImVyciIsImNvZGUiLCJjaGVjayIsIm5ldCIsImNvbm5lY3QiLCJ4cGlwZSIsImVxIiwicHJvY2VzcyIsImV4aXQiLCJlIiwiZnMiLCJ1bmxpbmtTeW5jIiwic2VydmVyIiwibGlzdGVuIiwiYWRkcmVzcyIsImNsb3NlZCIsImZvckVhY2giLCJjbGllbnQiLCJkZXN0cm95IiwiY2xvc2UiLCJTZXJ2ZXIiLCJjcmVhdGVTZXJ2ZXIiLCJjb25uZWN0aW9uSGFuZGxlciIsImVycm9ySGFuZGxlciIsIm1lc3NhZ2UiLCJkYXRhIiwicmVhZGluZyIsImluIiwicmVtb3RlQWRkcmVzcyIsInRvU3RyaW5nIiwiZXZlbnQiLCJhcmdzIiwiSlNPTiIsInBhcnNlIiwiaW5kZXgiLCJmaW5kSW5kZXgiLCJpdGVtIiwic3BsaWNlIiwiX3dyaXRlIiwiY2h1bmsiLCJlbmNvZGluZyIsImNhbGxiYWNrIiwib3V0Iiwid3JpdGUiLCJfcmVhZCIsInNpemUiLCJzZW5kIiwiUHJvbWlzZSIsInJlamVjdCIsIkVycm9yIiwicmVzb2x2ZSIsInN0cmluZ2lmeSIsImJyb2FkY2FzdCIsImFsbCIsIm1hcCIsInRoZW4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLEtBQUssR0FBRyxvQkFBYSxpQkFBYixDQUFkOztBQUNBLE1BQU1DLElBQUksR0FBRyxNQUFNLENBQUUsQ0FBckI7O0lBRVlDLFM7OztX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QVlFLE9BQVosTUFBeUIsRUFBMUIsRUFBOEJlLFFBQTlCLEVBQVA7QUFDRDs7QUFFRGlCLEVBQUFBLElBQUksQ0FBQzdCLE1BQUQsRUFBaUJhLEtBQWpCLEVBQWdDLEdBQUdDLElBQW5DLEVBQStEO0FBQ2pFLFFBQUksS0FBS2hCLE1BQVQsRUFBaUI7QUFDZixhQUFPZ0MsT0FBTyxDQUFDQyxNQUFSLENBQWUsSUFBSUMsS0FBSixDQUFVLGtCQUFWLENBQWYsQ0FBUDtBQUNEOztBQUNELFVBQU14QixJQUFJLEdBQUc7QUFDWEssTUFBQUEsS0FEVztBQUVYQyxNQUFBQTtBQUZXLEtBQWI7QUFJQSxXQUFPLElBQUlnQixPQUFKLENBQVlHLE9BQU8sSUFBSWpDLE1BQU0sQ0FBQzBCLEtBQVAsQ0FBYVgsSUFBSSxDQUFDbUIsU0FBTCxDQUFlMUIsSUFBZixDQUFiLEVBQW1DLE1BQU15QixPQUFPLEVBQWhELENBQXZCLENBQVA7QUFDRDs7QUFFREUsRUFBQUEsU0FBUyxDQUFDdEIsS0FBRCxFQUFnQixHQUFHQyxJQUFuQixFQUErQztBQUN0RCxXQUFPZ0IsT0FBTyxDQUFDTSxHQUFSLENBQVksS0FBSzlELE9BQUwsQ0FBYStELEdBQWIsQ0FBaUJyQyxNQUFNLElBQUksS0FBSzZCLElBQUwsQ0FBVTdCLE1BQVYsRUFBa0JhLEtBQWxCLEVBQXlCLEdBQUdDLElBQTVCLENBQTNCLENBQVosRUFDSndCLElBREksQ0FDQyxNQUFNLENBQUUsQ0FEVCxDQUFQO0FBRUQ7O0FBOUc0Qjs7ZUE0SGhCdkUsUyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgbmV0LCB7IFNvY2tldCwgU2VydmVyIH0gZnJvbSAnbmV0JztcbmltcG9ydCB7IER1cGxleCB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeHBpcGUgZnJvbSAneHBpcGUnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmlidXM6SVBDU2VydmVyJyk7XG5jb25zdCBub29wID0gKCkgPT4ge307XG5cbmV4cG9ydCBlbnVtIERpcmVjdGlvbiB7XG4gIGluLFxuICBvdXQsXG59XG5cbmludGVyZmFjZSBJUENTZXJ2ZXIge1xuICBvbihldmVudDogJ2Nvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKHNvY2tldDogU29ja2V0KSA9PiB2b2lkKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjbGllbnQ6ZXJyb3InLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzO1xuICBvbihldmVudDogJ3JhdycsIGxpc3RlbmVyOiAoZGF0YTogQnVmZmVyLCBkaXI6IERpcmVjdGlvbikgPT4gdm9pZCk6IHRoaXM7XG4gIG9uKGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzO1xuXG4gIG9uY2UoZXZlbnQ6ICdjb25uZWN0aW9uJywgbGlzdGVuZXI6IChzb2NrZXQ6IFNvY2tldCkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdyYXcnLCBsaXN0ZW5lcjogKGRhdGE6IEJ1ZmZlciwgZGlyOiBEaXJlY3Rpb24pID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGlvbicsIGxpc3RlbmVyOiAoc29ja2V0OiBTb2NrZXQpID0+IHZvaWQpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2NsaWVudDplcnJvcicsIGxpc3RlbmVyOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAncmF3JywgbGlzdGVuZXI6IChkYXRhOiBCdWZmZXIsIGRpcjogRGlyZWN0aW9uKSA9PiB2b2lkKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6IHN0cmluZyB8IHN5bWJvbCwgbGlzdGVuZXI6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZCk6IHRoaXM7XG5cbiAgZW1pdChldmVudDogJ2Nvbm5lY3Rpb24nLCBzb2NrZXQ6IFNvY2tldCk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjbGllbnQ6ZXJyb3InLCBlcnI6IEVycm9yKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3JhdycsIGRhdGE6IEJ1ZmZlciwgZGlyOiBEaXJlY3Rpb24pOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIC4uLmFyZ3M6IGFueVtdKTogYm9vbGVhbjtcbn1cblxuY2xhc3MgSVBDU2VydmVyIGV4dGVuZHMgRHVwbGV4IHtcbiAgcHJpdmF0ZSByZWFkb25seSBzZXJ2ZXI6IFNlcnZlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBjbGllbnRzOiBTb2NrZXRbXTtcbiAgcHJpdmF0ZSBjbG9zZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkaW5nID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocGF0aDogc3RyaW5nLCBwcml2YXRlIHJlYWRvbmx5IHJhdyA9IGZhbHNlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmNsaWVudHMgPSBbXTtcbiAgICB0aGlzLnNlcnZlciA9IG5ldyBTZXJ2ZXIoKTtcbiAgICB0aGlzLnNlcnZlciA9IG5ldFxuICAgICAgLmNyZWF0ZVNlcnZlcih0aGlzLmNvbm5lY3Rpb25IYW5kbGVyKVxuICAgICAgLm9uKCdlcnJvcicsIHRoaXMuZXJyb3JIYW5kbGVyKVxuICAgICAgLm9uKCdjbG9zZScsIHRoaXMuY2xvc2UpXG4gICAgICAubGlzdGVuKHhwaXBlLmVxKHBhdGgpLCAoKSA9PiB7XG4gICAgICAgIGRlYnVnKCdsaXN0ZW5pbmcgb24nLCB0aGlzLnNlcnZlci5hZGRyZXNzKCkpO1xuICAgICAgfSk7XG4gICAgcHJvY2Vzcy5vbignU0lHSU5UJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgICBwcm9jZXNzLm9uKCdTSUdURVJNJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29ubmVjdGlvbkhhbmRsZXIgPSAoc29ja2V0OiBTb2NrZXQpID0+IHtcbiAgICB0aGlzLmVtaXQoJ2Nvbm5lY3Rpb24nLCBzb2NrZXQpO1xuICAgIHRoaXMuY2xpZW50cy5wdXNoKHNvY2tldCk7XG4gICAgc29ja2V0XG4gICAgICAub25jZSgnZXJyb3InLCB0aGlzLmNsaWVudEVycm9ySGFuZGxlci5iaW5kKHRoaXMsIHNvY2tldCkpXG4gICAgICAub24oJ2RhdGEnLCB0aGlzLmNsaWVudERhdGFIYW5kbGVyLmJpbmQodGhpcywgc29ja2V0KSlcbiAgICAgIC5vbmNlKCdjbG9zZScsICgpID0+IHRoaXMucmVtb3ZlQ2xpZW50KHNvY2tldCkpO1xuICAgIGRlYnVnKCduZXcgY29ubmVjdGlvbiBvbicsIHRoaXMucGF0aCwgdGhpcy5jbGllbnRzLmxlbmd0aCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBlcnJvckhhbmRsZXIgPSAoZXJyOiBFcnJvcikgPT4ge1xuICAgIGlmICgoZXJyIGFzIGFueSkuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICBjb25zdCBjaGVjayA9IG5ldC5jb25uZWN0KHhwaXBlLmVxKHRoaXMucGF0aCksICgpID0+IHtcbiAgICAgICAgZGVidWcoJ1NlcnZlciBydW5uaW5nLCBnaXZpbmcgdXAuLi4nKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KCk7XG4gICAgICB9KTtcbiAgICAgIGNoZWNrLm9uY2UoJ2Vycm9yJywgKGUpID0+IHtcbiAgICAgICAgaWYgKChlIGFzIGFueSkuY29kZSA9PT0gJ0VDT05OUkVGVVNFRCcpIHtcbiAgICAgICAgICBmcy51bmxpbmtTeW5jKHhwaXBlLmVxKHRoaXMucGF0aCkpO1xuICAgICAgICAgIHRoaXMuc2VydmVyLmxpc3Rlbih4cGlwZS5lcSh0aGlzLnBhdGgpLCAoKSA9PiB7XG4gICAgICAgICAgICBkZWJ1ZygncmVzdGFydCcsIHRoaXMuc2VydmVyLmFkZHJlc3MoKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgY2xpZW50RXJyb3JIYW5kbGVyKGNsaWVudDogU29ja2V0LCBlcnI6IEVycm9yKSB7XG4gICAgZGVidWcoJ2Vycm9yIG9uIGNsaWVudCcsIGVyci5tZXNzYWdlKTtcbiAgICB0aGlzLmVtaXQoJ2NsaWVudDplcnJvcicsIGNsaWVudCwgZXJyKTtcbiAgICB0aGlzLnJlbW92ZUNsaWVudChjbGllbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjbGllbnREYXRhSGFuZGxlcihjbGllbnQ6IFNvY2tldCwgZGF0YTogQnVmZmVyKSB7XG4gICAgLy8gaWYgKHRoaXMucmFpZSkge1xuICAgIC8vICAgZGVidWcodGhpcy5wYXRoLCBwcmludEJ1ZmZlcihkYXRhKSk7XG4gICAgLy8gfVxuICAgIGlmICh0aGlzLnJlYWRpbmcpIHtcbiAgICAgIHRoaXMucmVhZGluZyA9IHRoaXMucHVzaChkYXRhKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucmF3KSAge1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgncmF3JywgZGF0YSwgRGlyZWN0aW9uLmluKTtcbiAgICB9XG4gICAgZGVidWcoJ2RhdGEgZnJvbScsIGNsaWVudC5yZW1vdGVBZGRyZXNzLCBkYXRhLnRvU3RyaW5nKCkpO1xuICAgIGNvbnN0IHsgZXZlbnQsIGFyZ3MgfSA9IEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICB0aGlzLmVtaXQoYGNsaWVudDoke2V2ZW50fWAsIGNsaWVudCwgLi4uYXJncyk7XG4gIH1cblxuICBwcml2YXRlIHJlbW92ZUNsaWVudChjbGllbnQ6IFNvY2tldCkge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jbGllbnRzLmZpbmRJbmRleChpdGVtID0+IGl0ZW0gPT09IGNsaWVudCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgdGhpcy5jbGllbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuICAgIGNsaWVudC5kZXN0cm95KCk7XG4gICAgZGVidWcoJ2Rlc3Ryb3kgY29ubmVjdGlvbiBvbicsIHRoaXMucGF0aCwgdGhpcy5jbGllbnRzLmxlbmd0aCk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6ZnVuY3Rpb24tbmFtZVxuICBfd3JpdGUoY2h1bms6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgY2FsbGJhY2s6IChlcnJvcj86IChFcnJvciB8IG51bGwpKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5lbWl0KCdyYXcnLCBjaHVuayBhcyBCdWZmZXIsIERpcmVjdGlvbi5vdXQpO1xuICAgIHRoaXMuY2xpZW50cy5mb3JFYWNoKGNsaWVudCA9PiBjbGllbnQud3JpdGUoY2h1bmssIGVuY29kaW5nLCBub29wKSk7XG4gICAgY2FsbGJhY2soKTtcbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpmdW5jdGlvbi1uYW1lXG4gIF9yZWFkKHNpemU6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMucmVhZGluZyA9IHRydWU7XG4gIH1cblxuICBwdWJsaWMgZ2V0IHBhdGgoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNlcnZlci5hZGRyZXNzKCkgfHwgJycpLnRvU3RyaW5nKCk7XG4gIH1cblxuICBzZW5kKGNsaWVudDogU29ja2V0LCBldmVudDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmNsb3NlZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignU2VydmVyIGlzIGNsb3NlZCcpKTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIGV2ZW50LFxuICAgICAgYXJncyxcbiAgICB9O1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IGNsaWVudC53cml0ZShKU09OLnN0cmluZ2lmeShkYXRhKSwgKCkgPT4gcmVzb2x2ZSgpKSk7XG4gIH1cblxuICBicm9hZGNhc3QoZXZlbnQ6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodGhpcy5jbGllbnRzLm1hcChjbGllbnQgPT4gdGhpcy5zZW5kKGNsaWVudCwgZXZlbnQsIC4uLmFyZ3MpKSlcbiAgICAgIC50aGVuKCgpID0+IHt9KTtcbiAgfVxuXG4gIGNsb3NlID0gKCkgPT4ge1xuICAgIGlmICh0aGlzLmNsb3NlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnNlcnZlci5hZGRyZXNzKCk7XG4gICAgdGhpcy5jbGllbnRzLmZvckVhY2goY2xpZW50ID0+IGNsaWVudC5kZXN0cm95KCkpO1xuICAgIHRoaXMuY2xpZW50cy5sZW5ndGggPSAwO1xuICAgIHRoaXMuc2VydmVyLmNsb3NlKCk7XG4gICAgdGhpcy5yYXcgJiYgdGhpcy5wdXNoKG51bGwpO1xuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZTtcbiAgICBkZWJ1ZyhgJHtwYXRofSBjbG9zZWRgKTtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgSVBDU2VydmVyO1xuIl19