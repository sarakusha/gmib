"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _lodash = _interopRequireDefault(require("lodash"));

var _tableLayout = _interopRequireDefault(require("table-layout"));

var _nibus = require("@nata/nibus.js-client");

var _ipc = require("@nata/nibus.js-client/lib/ipc");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// @ts-ignore
const listCommand = {
  command: 'list',
  describe: 'Показать список доступных устройств',
  builder: {},
  handler: async () => new Promise((resolve, reject) => {
    const socket = _ipc.Client.connect(_nibus.PATH);

    let resolved = false;
    let error;
    socket.once('close', () => {
      resolved ? resolve() : reject(error && error.message);
    });
    socket.on('ports', ports => {
      // debug('ports', ports);
      const rows = _lodash.default.sortBy(ports, [_lodash.default.property('description.category')]).map(({
        portInfo: {
          manufacturer,
          category,
          device,
          comName
        }
      }) => ({
        manufacturer,
        category,
        device,
        comName
      }));

      const table = new _tableLayout.default(rows, {
        maxWidth: 80
      });
      console.info(table.toString());
      resolved = true;
      socket.destroy();
    });
    socket.on('error', err => {
      if (err.code === 'ENOENT') {
        error = {
          message: 'Сервис не запущен'
        };
      } else {
        error = err;
      }
    });
  }) // const rows = _.sortBy<IKnownPort>(ports, [_.property('manufacturer'),
  // _.property('category')]) .map(({ manufacturer, category, device, comName }) => ({
  // manufacturer, category, device, comName, })); const table = new Table(rows, { maxWidth: 80
  // }); console.info(table.toString());

};
var _default = listCommand;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvY29tbWFuZHMvbGlzdC50cyJdLCJuYW1lcyI6WyJsaXN0Q29tbWFuZCIsImNvbW1hbmQiLCJkZXNjcmliZSIsImJ1aWxkZXIiLCJoYW5kbGVyIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJzb2NrZXQiLCJDbGllbnQiLCJjb25uZWN0IiwiUEFUSCIsInJlc29sdmVkIiwiZXJyb3IiLCJvbmNlIiwibWVzc2FnZSIsIm9uIiwicG9ydHMiLCJyb3dzIiwiXyIsInNvcnRCeSIsInByb3BlcnR5IiwibWFwIiwicG9ydEluZm8iLCJtYW51ZmFjdHVyZXIiLCJjYXRlZ29yeSIsImRldmljZSIsImNvbU5hbWUiLCJ0YWJsZSIsIlRhYmxlIiwibWF4V2lkdGgiLCJjb25zb2xlIiwiaW5mbyIsInRvU3RyaW5nIiwiZGVzdHJveSIsImVyciIsImNvZGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVdBOztBQUVBOztBQUNBOztBQUNBOzs7O0FBSEE7QUFLQSxNQUFNQSxXQUEwQixHQUFHO0FBQ2pDQyxFQUFBQSxPQUFPLEVBQUUsTUFEd0I7QUFFakNDLEVBQUFBLFFBQVEsRUFBRSxxQ0FGdUI7QUFHakNDLEVBQUFBLE9BQU8sRUFBRSxFQUh3QjtBQUlqQ0MsRUFBQUEsT0FBTyxFQUFFLFlBQVksSUFBSUMsT0FBSixDQUFZLENBQUNDLE9BQUQsRUFBVUMsTUFBVixLQUFxQjtBQUNwRCxVQUFNQyxNQUFNLEdBQUdDLFlBQU9DLE9BQVAsQ0FBZUMsV0FBZixDQUFmOztBQUNBLFFBQUlDLFFBQVEsR0FBRyxLQUFmO0FBQ0EsUUFBSUMsS0FBSjtBQUNBTCxJQUFBQSxNQUFNLENBQUNNLElBQVAsQ0FBWSxPQUFaLEVBQXFCLE1BQU07QUFDekJGLE1BQUFBLFFBQVEsR0FBR04sT0FBTyxFQUFWLEdBQWVDLE1BQU0sQ0FBQ00sS0FBSyxJQUFJQSxLQUFLLENBQUNFLE9BQWhCLENBQTdCO0FBQ0QsS0FGRDtBQUdBUCxJQUFBQSxNQUFNLENBQUNRLEVBQVAsQ0FBVSxPQUFWLEVBQW9CQyxLQUFELElBQXVCO0FBQ3hDO0FBQ0EsWUFBTUMsSUFBSSxHQUFHQyxnQkFBRUMsTUFBRixDQUFTSCxLQUFULEVBQWdCLENBQUNFLGdCQUFFRSxRQUFGLENBQVcsc0JBQVgsQ0FBRCxDQUFoQixFQUNWQyxHQURVLENBQ04sQ0FBQztBQUFFQyxRQUFBQSxRQUFRLEVBQUU7QUFBRUMsVUFBQUEsWUFBRjtBQUFnQkMsVUFBQUEsUUFBaEI7QUFBMEJDLFVBQUFBLE1BQTFCO0FBQWtDQyxVQUFBQTtBQUFsQztBQUFaLE9BQUQsTUFBZ0U7QUFDbkVILFFBQUFBLFlBRG1FO0FBRW5FQyxRQUFBQSxRQUZtRTtBQUduRUMsUUFBQUEsTUFIbUU7QUFJbkVDLFFBQUFBO0FBSm1FLE9BQWhFLENBRE0sQ0FBYjs7QUFPQSxZQUFNQyxLQUFLLEdBQUcsSUFBSUMsb0JBQUosQ0FBVVgsSUFBVixFQUFnQjtBQUM1QlksUUFBQUEsUUFBUSxFQUFFO0FBRGtCLE9BQWhCLENBQWQ7QUFHQUMsTUFBQUEsT0FBTyxDQUFDQyxJQUFSLENBQWFKLEtBQUssQ0FBQ0ssUUFBTixFQUFiO0FBQ0FyQixNQUFBQSxRQUFRLEdBQUcsSUFBWDtBQUNBSixNQUFBQSxNQUFNLENBQUMwQixPQUFQO0FBQ0QsS0FmRDtBQWdCQTFCLElBQUFBLE1BQU0sQ0FBQ1EsRUFBUCxDQUFVLE9BQVYsRUFBb0JtQixHQUFELElBQVM7QUFDMUIsVUFBS0EsR0FBRCxDQUFhQyxJQUFiLEtBQXNCLFFBQTFCLEVBQW9DO0FBQ2xDdkIsUUFBQUEsS0FBSyxHQUFHO0FBQUVFLFVBQUFBLE9BQU8sRUFBRTtBQUFYLFNBQVI7QUFDRCxPQUZELE1BRU87QUFDTEYsUUFBQUEsS0FBSyxHQUFHc0IsR0FBUjtBQUNEO0FBQ0YsS0FORDtBQU9ELEdBOUJvQixDQUpZLENBb0NuQztBQUNBO0FBQ0E7QUFDQTs7QUF2Q21DLENBQW5DO2VBMENlbkMsVyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgeyBDb21tYW5kTW9kdWxlIH0gZnJvbSAneWFyZ3MnO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCBUYWJsZSBmcm9tICd0YWJsZS1sYXlvdXQnO1xuaW1wb3J0IHsgUEFUSCB9IGZyb20gJ0BuYXRhL25pYnVzLmpzLWNsaWVudCc7XG5pbXBvcnQgeyBDbGllbnQsIElQb3J0QXJnIH0gZnJvbSAnQG5hdGEvbmlidXMuanMtY2xpZW50L2xpYi9pcGMnO1xuXG5jb25zdCBsaXN0Q29tbWFuZDogQ29tbWFuZE1vZHVsZSA9IHtcbiAgY29tbWFuZDogJ2xpc3QnLFxuICBkZXNjcmliZTogJ9Cf0L7QutCw0LfQsNGC0Ywg0YHQv9C40YHQvtC6INC00L7RgdGC0YPQv9C90YvRhSDRg9GB0YLRgNC+0LnRgdGC0LInLFxuICBidWlsZGVyOiB7fSxcbiAgaGFuZGxlcjogYXN5bmMgKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHNvY2tldCA9IENsaWVudC5jb25uZWN0KFBBVEgpO1xuICAgIGxldCByZXNvbHZlZCA9IGZhbHNlO1xuICAgIGxldCBlcnJvcjogYW55O1xuICAgIHNvY2tldC5vbmNlKCdjbG9zZScsICgpID0+IHtcbiAgICAgIHJlc29sdmVkID8gcmVzb2x2ZSgpIDogcmVqZWN0KGVycm9yICYmIGVycm9yLm1lc3NhZ2UpO1xuICAgIH0pO1xuICAgIHNvY2tldC5vbigncG9ydHMnLCAocG9ydHM6IElQb3J0QXJnW10pID0+IHtcbiAgICAgIC8vIGRlYnVnKCdwb3J0cycsIHBvcnRzKTtcbiAgICAgIGNvbnN0IHJvd3MgPSBfLnNvcnRCeShwb3J0cywgW18ucHJvcGVydHkoJ2Rlc2NyaXB0aW9uLmNhdGVnb3J5JyldKVxuICAgICAgICAubWFwKCh7IHBvcnRJbmZvOiB7IG1hbnVmYWN0dXJlciwgY2F0ZWdvcnksIGRldmljZSwgY29tTmFtZSB9IH0pID0+ICh7XG4gICAgICAgICAgbWFudWZhY3R1cmVyLFxuICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgIGRldmljZSxcbiAgICAgICAgICBjb21OYW1lLFxuICAgICAgICB9KSk7XG4gICAgICBjb25zdCB0YWJsZSA9IG5ldyBUYWJsZShyb3dzLCB7XG4gICAgICAgIG1heFdpZHRoOiA4MCxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5pbmZvKHRhYmxlLnRvU3RyaW5nKCkpO1xuICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICB9KTtcbiAgICBzb2NrZXQub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgaWYgKChlcnIgYXMgYW55KS5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgICBlcnJvciA9IHsgbWVzc2FnZTogJ9Ch0LXRgNCy0LjRgSDQvdC1INC30LDQv9GD0YnQtdC9JyB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pLFxuXG4vLyBjb25zdCByb3dzID0gXy5zb3J0Qnk8SUtub3duUG9ydD4ocG9ydHMsIFtfLnByb3BlcnR5KCdtYW51ZmFjdHVyZXInKSxcbi8vIF8ucHJvcGVydHkoJ2NhdGVnb3J5JyldKSAubWFwKCh7IG1hbnVmYWN0dXJlciwgY2F0ZWdvcnksIGRldmljZSwgY29tTmFtZSB9KSA9PiAoe1xuLy8gbWFudWZhY3R1cmVyLCBjYXRlZ29yeSwgZGV2aWNlLCBjb21OYW1lLCB9KSk7IGNvbnN0IHRhYmxlID0gbmV3IFRhYmxlKHJvd3MsIHsgbWF4V2lkdGg6IDgwXG4vLyB9KTsgY29uc29sZS5pbmZvKHRhYmxlLnRvU3RyaW5nKCkpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbGlzdENvbW1hbmQ7XG4iXX0=