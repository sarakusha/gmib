"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.startOptions = void 0;

require("source-map-support/register");

var _pm = _interopRequireDefault(require("pm2"));

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
// import { promisify } from 'util';
const debug = (0, _debug.default)('nibus:start'); // import { promisify } from 'util';
// const connect = promisify(pm2.connect);
// const start = promisify<StartOptions>(pm2.start);

const startOptions = {
  name: 'nibus.service',
  script: 'service/demon.js',
  cwd: _path.default.resolve(__dirname, '../..'),
  max_restarts: 3,
  env: {
    DEBUG: 'nibus:*,-nibus:decoder',
    DEBUG_COLORS: '1'
  }
};
exports.startOptions = startOptions;

if (_path.default.extname(__filename) === '.ts') {
  startOptions.script = 'service/dev.start.js';
  startOptions.watch = ['service/demon.ts', 'ipc/Server.ts', 'ipc/SerialTee.ts', 'service/detector.ts'];
}

const startup = platform => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

  _pm.default.startup(platform, err => {
    clearTimeout(timeout);
    if (err) return reject(err);
    resolve();
  });
});

const startCommand = {
  command: 'start',
  describe: 'запустить сервис NiBUS',
  builder: argv => argv.option('auto', {
    describe: 'автозапуск сервиса после старта стистемы для заданной ОС',
    choices: ['ubuntu', 'centos', 'redhat', 'gentoo', 'systemd', 'darwin', 'amazon']
  }),
  handler: argc => {
    _pm.default.connect(err => {
      if (err) {
        console.error('не удалось подключиться к pm2', err.message);
        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(startOptions.name, () => _pm.default.start(startOptions, async err => {
        if (!err && argc.auto) {
          try {
            await startup(argc.auto);
          } catch (e) {
            console.error('Не удалось зарегестрировать сервис', e.message);
          }
        }

        _pm.default.disconnect();

        if (err) {
          console.error('error while start nibus.service', err);
          process.exit(2);
        }

        console.info('nibus.service запущен');
      }));
    });
  }
};
var _default = startCommand;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvY29tbWFuZHMvc3RhcnQudHMiXSwibmFtZXMiOlsiZGVidWciLCJzdGFydE9wdGlvbnMiLCJuYW1lIiwic2NyaXB0IiwiY3dkIiwicGF0aCIsInJlc29sdmUiLCJfX2Rpcm5hbWUiLCJtYXhfcmVzdGFydHMiLCJlbnYiLCJERUJVRyIsIkRFQlVHX0NPTE9SUyIsImV4dG5hbWUiLCJfX2ZpbGVuYW1lIiwid2F0Y2giLCJzdGFydHVwIiwicGxhdGZvcm0iLCJQcm9taXNlIiwicmVqZWN0IiwidGltZW91dCIsInNldFRpbWVvdXQiLCJFcnJvciIsInBtMiIsImVyciIsImNsZWFyVGltZW91dCIsInN0YXJ0Q29tbWFuZCIsImNvbW1hbmQiLCJkZXNjcmliZSIsImJ1aWxkZXIiLCJhcmd2Iiwib3B0aW9uIiwiY2hvaWNlcyIsImhhbmRsZXIiLCJhcmdjIiwiY29ubmVjdCIsImNvbnNvbGUiLCJlcnJvciIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwiZXhpdCIsImRlbGV0ZSIsInN0YXJ0IiwiYXV0byIsImUiLCJkaXNjb25uZWN0IiwiaW5mbyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBRUE7O0FBQ0E7Ozs7QUFiQTs7Ozs7Ozs7O0FBY0E7QUFFQSxNQUFNQSxLQUFLLEdBQUcsb0JBQWEsYUFBYixDQUFkLEMsQ0FDQTtBQUVBO0FBQ0E7O0FBRU8sTUFBTUMsWUFBMEIsR0FBRztBQUN4Q0MsRUFBQUEsSUFBSSxFQUFFLGVBRGtDO0FBRXhDQyxFQUFBQSxNQUFNLEVBQUUsa0JBRmdDO0FBR3hDQyxFQUFBQSxHQUFHLEVBQUVDLGNBQUtDLE9BQUwsQ0FBYUMsU0FBYixFQUF3QixPQUF4QixDQUhtQztBQUl4Q0MsRUFBQUEsWUFBWSxFQUFFLENBSjBCO0FBS3hDQyxFQUFBQSxHQUFHLEVBQUU7QUFDSEMsSUFBQUEsS0FBSyxFQUFFLHdCQURKO0FBRUhDLElBQUFBLFlBQVksRUFBRTtBQUZYO0FBTG1DLENBQW5DOzs7QUFXUCxJQUFJTixjQUFLTyxPQUFMLENBQWFDLFVBQWIsTUFBNkIsS0FBakMsRUFBd0M7QUFDdENaLEVBQUFBLFlBQVksQ0FBQ0UsTUFBYixHQUFzQixzQkFBdEI7QUFDQUYsRUFBQUEsWUFBWSxDQUFDYSxLQUFiLEdBQXFCLENBQ25CLGtCQURtQixFQUVuQixlQUZtQixFQUduQixrQkFIbUIsRUFJbkIscUJBSm1CLENBQXJCO0FBTUQ7O0FBRUQsTUFBTUMsT0FBTyxHQUFJQyxRQUFELElBQW1CLElBQUlDLE9BQUosQ0FBYSxDQUFDWCxPQUFELEVBQVVZLE1BQVYsS0FBcUI7QUFDbkUsUUFBTUMsT0FBTyxHQUFHQyxVQUFVLENBQUMsTUFBTUYsTUFBTSxDQUFDLElBQUlHLEtBQUosQ0FBVSxTQUFWLENBQUQsQ0FBYixFQUFxQyxLQUFyQyxDQUExQjs7QUFDQUMsY0FBSVAsT0FBSixDQUFZQyxRQUFaLEVBQXVCTyxHQUFELElBQVM7QUFDN0JDLElBQUFBLFlBQVksQ0FBQ0wsT0FBRCxDQUFaO0FBQ0EsUUFBSUksR0FBSixFQUFTLE9BQU9MLE1BQU0sQ0FBQ0ssR0FBRCxDQUFiO0FBQ1RqQixJQUFBQSxPQUFPO0FBQ1IsR0FKRDtBQUtELENBUGtDLENBQW5DOztBQVNBLE1BQU1tQixZQUEyQixHQUFHO0FBQ2xDQyxFQUFBQSxPQUFPLEVBQUUsT0FEeUI7QUFFbENDLEVBQUFBLFFBQVEsRUFBRSx3QkFGd0I7QUFHbENDLEVBQUFBLE9BQU8sRUFBRUMsSUFBSSxJQUFJQSxJQUFJLENBQ2xCQyxNQURjLENBQ1AsTUFETyxFQUNDO0FBQ2RILElBQUFBLFFBQVEsRUFBRSwwREFESTtBQUVkSSxJQUFBQSxPQUFPLEVBQUUsQ0FBQyxRQUFELEVBQVcsUUFBWCxFQUFxQixRQUFyQixFQUErQixRQUEvQixFQUF5QyxTQUF6QyxFQUFvRCxRQUFwRCxFQUE4RCxRQUE5RDtBQUZLLEdBREQsQ0FIaUI7QUFRbENDLEVBQUFBLE9BQU8sRUFBR0MsSUFBRCxJQUFVO0FBQ2pCWCxnQkFBSVksT0FBSixDQUFhWCxHQUFELElBQVM7QUFDbkIsVUFBSUEsR0FBSixFQUFTO0FBQ1BZLFFBQUFBLE9BQU8sQ0FBQ0MsS0FBUixDQUFjLCtCQUFkLEVBQStDYixHQUFHLENBQUNjLE9BQW5EO0FBQ0FDLFFBQUFBLE9BQU8sQ0FBQ0MsSUFBUixDQUFhLENBQWI7QUFDRDs7QUFDRHZDLE1BQUFBLEtBQUssQ0FBQyxrQkFBRCxDQUFMOztBQUNBc0Isa0JBQUlrQixNQUFKLENBQVd2QyxZQUFZLENBQUNDLElBQXhCLEVBQStCLE1BQzdCb0IsWUFBSW1CLEtBQUosQ0FBVXhDLFlBQVYsRUFBd0IsTUFBT3NCLEdBQVAsSUFBZTtBQUNyQyxZQUFJLENBQUNBLEdBQUQsSUFBUVUsSUFBSSxDQUFDUyxJQUFqQixFQUF1QjtBQUNyQixjQUFJO0FBQ0Ysa0JBQU0zQixPQUFPLENBQUNrQixJQUFJLENBQUNTLElBQU4sQ0FBYjtBQUNELFdBRkQsQ0FFRSxPQUFPQyxDQUFQLEVBQVU7QUFDVlIsWUFBQUEsT0FBTyxDQUFDQyxLQUFSLENBQWMsb0NBQWQsRUFBb0RPLENBQUMsQ0FBQ04sT0FBdEQ7QUFDRDtBQUNGOztBQUNEZixvQkFBSXNCLFVBQUo7O0FBQ0EsWUFBSXJCLEdBQUosRUFBUztBQUNQWSxVQUFBQSxPQUFPLENBQUNDLEtBQVIsQ0FBYyxpQ0FBZCxFQUFpRGIsR0FBakQ7QUFDQWUsVUFBQUEsT0FBTyxDQUFDQyxJQUFSLENBQWEsQ0FBYjtBQUNEOztBQUNESixRQUFBQSxPQUFPLENBQUNVLElBQVIsQ0FBYSx1QkFBYjtBQUNELE9BZEQsQ0FERjtBQWdCRCxLQXRCRDtBQXVCRDtBQWhDaUMsQ0FBcEM7ZUFtQ2VwQixZIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBwbTIsIHsgU3RhcnRPcHRpb25zIH0gZnJvbSAncG0yJztcbmltcG9ydCB7IENvbW1hbmRNb2R1bGUgfSBmcm9tICd5YXJncyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuLy8gaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpzdGFydCcpO1xuLy8gaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5cbi8vIGNvbnN0IGNvbm5lY3QgPSBwcm9taXNpZnkocG0yLmNvbm5lY3QpO1xuLy8gY29uc3Qgc3RhcnQgPSBwcm9taXNpZnk8U3RhcnRPcHRpb25zPihwbTIuc3RhcnQpO1xuXG5leHBvcnQgY29uc3Qgc3RhcnRPcHRpb25zOiBTdGFydE9wdGlvbnMgPSB7XG4gIG5hbWU6ICduaWJ1cy5zZXJ2aWNlJyxcbiAgc2NyaXB0OiAnc2VydmljZS9kZW1vbi5qcycsXG4gIGN3ZDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uJyksXG4gIG1heF9yZXN0YXJ0czogMyxcbiAgZW52OiB7XG4gICAgREVCVUc6ICduaWJ1czoqLC1uaWJ1czpkZWNvZGVyJyxcbiAgICBERUJVR19DT0xPUlM6ICcxJyxcbiAgfSxcbn07XG5cbmlmIChwYXRoLmV4dG5hbWUoX19maWxlbmFtZSkgPT09ICcudHMnKSB7XG4gIHN0YXJ0T3B0aW9ucy5zY3JpcHQgPSAnc2VydmljZS9kZXYuc3RhcnQuanMnO1xuICBzdGFydE9wdGlvbnMud2F0Y2ggPSBbXG4gICAgJ3NlcnZpY2UvZGVtb24udHMnLFxuICAgICdpcGMvU2VydmVyLnRzJyxcbiAgICAnaXBjL1NlcmlhbFRlZS50cycsXG4gICAgJ3NlcnZpY2UvZGV0ZWN0b3IudHMnLFxuICBdO1xufVxuXG5jb25zdCBzdGFydHVwID0gKHBsYXRmb3JtOiBhbnkpID0+IG5ldyBQcm9taXNlKCgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChuZXcgRXJyb3IoJ1RpbWVvdXQnKSksIDEwMDAwKTtcbiAgcG0yLnN0YXJ0dXAocGxhdGZvcm0sIChlcnIpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgaWYgKGVycikgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgIHJlc29sdmUoKTtcbiAgfSk7XG59KSk7XG5cbmNvbnN0IHN0YXJ0Q29tbWFuZDogQ29tbWFuZE1vZHVsZSA9IHtcbiAgY29tbWFuZDogJ3N0YXJ0JyxcbiAgZGVzY3JpYmU6ICfQt9Cw0L/Rg9GB0YLQuNGC0Ywg0YHQtdGA0LLQuNGBIE5pQlVTJyxcbiAgYnVpbGRlcjogYXJndiA9PiBhcmd2XG4gICAgLm9wdGlvbignYXV0bycsIHtcbiAgICAgIGRlc2NyaWJlOiAn0LDQstGC0L7Qt9Cw0L/Rg9GB0Log0YHQtdGA0LLQuNGB0LAg0L/QvtGB0LvQtSDRgdGC0LDRgNGC0LAg0YHRgtC40YHRgtC10LzRiyDQtNC70Y8g0LfQsNC00LDQvdC90L7QuSDQntChJyxcbiAgICAgIGNob2ljZXM6IFsndWJ1bnR1JywgJ2NlbnRvcycsICdyZWRoYXQnLCAnZ2VudG9vJywgJ3N5c3RlbWQnLCAnZGFyd2luJywgJ2FtYXpvbiddLFxuICAgIH0pLFxuICBoYW5kbGVyOiAoYXJnYykgPT4ge1xuICAgIHBtMi5jb25uZWN0KChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign0L3QtSDRg9C00LDQu9C+0YHRjCDQv9C+0LTQutC70Y7Rh9C40YLRjNGB0Y8g0LogcG0yJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMik7XG4gICAgICB9XG4gICAgICBkZWJ1ZygncG0yIGlzIGNvbm5lY3RlZCcpO1xuICAgICAgcG0yLmRlbGV0ZShzdGFydE9wdGlvbnMubmFtZSEsICgpID0+XG4gICAgICAgIHBtMi5zdGFydChzdGFydE9wdGlvbnMsIGFzeW5jIChlcnIpID0+IHtcbiAgICAgICAgICBpZiAoIWVyciAmJiBhcmdjLmF1dG8pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IHN0YXJ0dXAoYXJnYy5hdXRvIGFzIGFueSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ9Cd0LUg0YPQtNCw0LvQvtGB0Ywg0LfQsNGA0LXQs9C10YHRgtGA0LjRgNC+0LLQsNGC0Ywg0YHQtdGA0LLQuNGBJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcG0yLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdlcnJvciB3aGlsZSBzdGFydCBuaWJ1cy5zZXJ2aWNlJywgZXJyKTtcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5pbmZvKCduaWJ1cy5zZXJ2aWNlINC30LDQv9GD0YnQtdC9Jyk7XG4gICAgICAgIH0pKTtcbiAgICB9KTtcbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHN0YXJ0Q29tbWFuZDtcbiJdfQ==