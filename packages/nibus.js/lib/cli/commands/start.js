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
  script: 'service/daemon.js',
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvY29tbWFuZHMvc3RhcnQudHMiXSwibmFtZXMiOlsiZGVidWciLCJzdGFydE9wdGlvbnMiLCJuYW1lIiwic2NyaXB0IiwiY3dkIiwicGF0aCIsInJlc29sdmUiLCJfX2Rpcm5hbWUiLCJtYXhfcmVzdGFydHMiLCJlbnYiLCJERUJVRyIsIkRFQlVHX0NPTE9SUyIsImV4dG5hbWUiLCJfX2ZpbGVuYW1lIiwid2F0Y2giLCJzdGFydHVwIiwicGxhdGZvcm0iLCJQcm9taXNlIiwicmVqZWN0IiwidGltZW91dCIsInNldFRpbWVvdXQiLCJFcnJvciIsInBtMiIsImVyciIsImNsZWFyVGltZW91dCIsInN0YXJ0Q29tbWFuZCIsImNvbW1hbmQiLCJkZXNjcmliZSIsImJ1aWxkZXIiLCJhcmd2Iiwib3B0aW9uIiwiY2hvaWNlcyIsImhhbmRsZXIiLCJhcmdjIiwiY29ubmVjdCIsImNvbnNvbGUiLCJlcnJvciIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwiZXhpdCIsImRlbGV0ZSIsInN0YXJ0IiwiYXV0byIsImUiLCJkaXNjb25uZWN0IiwiaW5mbyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBRUE7O0FBQ0E7Ozs7QUFiQTs7Ozs7Ozs7O0FBY0E7QUFFQSxNQUFNQSxLQUFLLEdBQUcsb0JBQWEsYUFBYixDQUFkLEMsQ0FDQTtBQUVBO0FBQ0E7O0FBRU8sTUFBTUMsWUFBMEIsR0FBRztBQUN4Q0MsRUFBQUEsSUFBSSxFQUFFLGVBRGtDO0FBRXhDQyxFQUFBQSxNQUFNLEVBQUUsbUJBRmdDO0FBR3hDQyxFQUFBQSxHQUFHLEVBQUVDLGNBQUtDLE9BQUwsQ0FBYUMsU0FBYixFQUF3QixPQUF4QixDQUhtQztBQUl4Q0MsRUFBQUEsWUFBWSxFQUFFLENBSjBCO0FBS3hDQyxFQUFBQSxHQUFHLEVBQUU7QUFDSEMsSUFBQUEsS0FBSyxFQUFFLHdCQURKO0FBRUhDLElBQUFBLFlBQVksRUFBRTtBQUZYO0FBTG1DLENBQW5DOzs7QUFXUCxJQUFJTixjQUFLTyxPQUFMLENBQWFDLFVBQWIsTUFBNkIsS0FBakMsRUFBd0M7QUFDdENaLEVBQUFBLFlBQVksQ0FBQ0UsTUFBYixHQUFzQixzQkFBdEI7QUFDQUYsRUFBQUEsWUFBWSxDQUFDYSxLQUFiLEdBQXFCLENBQ25CLGtCQURtQixFQUVuQixlQUZtQixFQUduQixrQkFIbUIsRUFJbkIscUJBSm1CLENBQXJCO0FBTUQ7O0FBRUQsTUFBTUMsT0FBTyxHQUFJQyxRQUFELElBQW1CLElBQUlDLE9BQUosQ0FBYSxDQUFDWCxPQUFELEVBQVVZLE1BQVYsS0FBcUI7QUFDbkUsUUFBTUMsT0FBTyxHQUFHQyxVQUFVLENBQUMsTUFBTUYsTUFBTSxDQUFDLElBQUlHLEtBQUosQ0FBVSxTQUFWLENBQUQsQ0FBYixFQUFxQyxLQUFyQyxDQUExQjs7QUFDQUMsY0FBSVAsT0FBSixDQUFZQyxRQUFaLEVBQXVCTyxHQUFELElBQVM7QUFDN0JDLElBQUFBLFlBQVksQ0FBQ0wsT0FBRCxDQUFaO0FBQ0EsUUFBSUksR0FBSixFQUFTLE9BQU9MLE1BQU0sQ0FBQ0ssR0FBRCxDQUFiO0FBQ1RqQixJQUFBQSxPQUFPO0FBQ1IsR0FKRDtBQUtELENBUGtDLENBQW5DOztBQVNBLE1BQU1tQixZQUEyQixHQUFHO0FBQ2xDQyxFQUFBQSxPQUFPLEVBQUUsT0FEeUI7QUFFbENDLEVBQUFBLFFBQVEsRUFBRSx3QkFGd0I7QUFHbENDLEVBQUFBLE9BQU8sRUFBRUMsSUFBSSxJQUFJQSxJQUFJLENBQ2xCQyxNQURjLENBQ1AsTUFETyxFQUNDO0FBQ2RILElBQUFBLFFBQVEsRUFBRSwwREFESTtBQUVkSSxJQUFBQSxPQUFPLEVBQUUsQ0FBQyxRQUFELEVBQVcsUUFBWCxFQUFxQixRQUFyQixFQUErQixRQUEvQixFQUF5QyxTQUF6QyxFQUFvRCxRQUFwRCxFQUE4RCxRQUE5RDtBQUZLLEdBREQsQ0FIaUI7QUFRbENDLEVBQUFBLE9BQU8sRUFBR0MsSUFBRCxJQUFVO0FBQ2pCWCxnQkFBSVksT0FBSixDQUFhWCxHQUFELElBQVM7QUFDbkIsVUFBSUEsR0FBSixFQUFTO0FBQ1BZLFFBQUFBLE9BQU8sQ0FBQ0MsS0FBUixDQUFjLCtCQUFkLEVBQStDYixHQUFHLENBQUNjLE9BQW5EO0FBQ0FDLFFBQUFBLE9BQU8sQ0FBQ0MsSUFBUixDQUFhLENBQWI7QUFDRDs7QUFDRHZDLE1BQUFBLEtBQUssQ0FBQyxrQkFBRCxDQUFMOztBQUNBc0Isa0JBQUlrQixNQUFKLENBQVd2QyxZQUFZLENBQUNDLElBQXhCLEVBQStCLE1BQzdCb0IsWUFBSW1CLEtBQUosQ0FBVXhDLFlBQVYsRUFBd0IsTUFBT3NCLEdBQVAsSUFBZTtBQUNyQyxZQUFJLENBQUNBLEdBQUQsSUFBUVUsSUFBSSxDQUFDUyxJQUFqQixFQUF1QjtBQUNyQixjQUFJO0FBQ0Ysa0JBQU0zQixPQUFPLENBQUNrQixJQUFJLENBQUNTLElBQU4sQ0FBYjtBQUNELFdBRkQsQ0FFRSxPQUFPQyxDQUFQLEVBQVU7QUFDVlIsWUFBQUEsT0FBTyxDQUFDQyxLQUFSLENBQWMsb0NBQWQsRUFBb0RPLENBQUMsQ0FBQ04sT0FBdEQ7QUFDRDtBQUNGOztBQUNEZixvQkFBSXNCLFVBQUo7O0FBQ0EsWUFBSXJCLEdBQUosRUFBUztBQUNQWSxVQUFBQSxPQUFPLENBQUNDLEtBQVIsQ0FBYyxpQ0FBZCxFQUFpRGIsR0FBakQ7QUFDQWUsVUFBQUEsT0FBTyxDQUFDQyxJQUFSLENBQWEsQ0FBYjtBQUNEOztBQUNESixRQUFBQSxPQUFPLENBQUNVLElBQVIsQ0FBYSx1QkFBYjtBQUNELE9BZEQsQ0FERjtBQWdCRCxLQXRCRDtBQXVCRDtBQWhDaUMsQ0FBcEM7ZUFtQ2VwQixZIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBwbTIsIHsgU3RhcnRPcHRpb25zIH0gZnJvbSAncG0yJztcbmltcG9ydCB7IENvbW1hbmRNb2R1bGUgfSBmcm9tICd5YXJncyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuLy8gaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpzdGFydCcpO1xuLy8gaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5cbi8vIGNvbnN0IGNvbm5lY3QgPSBwcm9taXNpZnkocG0yLmNvbm5lY3QpO1xuLy8gY29uc3Qgc3RhcnQgPSBwcm9taXNpZnk8U3RhcnRPcHRpb25zPihwbTIuc3RhcnQpO1xuXG5leHBvcnQgY29uc3Qgc3RhcnRPcHRpb25zOiBTdGFydE9wdGlvbnMgPSB7XG4gIG5hbWU6ICduaWJ1cy5zZXJ2aWNlJyxcbiAgc2NyaXB0OiAnc2VydmljZS9kYWVtb24uanMnLFxuICBjd2Q6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLicpLFxuICBtYXhfcmVzdGFydHM6IDMsXG4gIGVudjoge1xuICAgIERFQlVHOiAnbmlidXM6KiwtbmlidXM6ZGVjb2RlcicsXG4gICAgREVCVUdfQ09MT1JTOiAnMScsXG4gIH0sXG59O1xuXG5pZiAocGF0aC5leHRuYW1lKF9fZmlsZW5hbWUpID09PSAnLnRzJykge1xuICBzdGFydE9wdGlvbnMuc2NyaXB0ID0gJ3NlcnZpY2UvZGV2LnN0YXJ0LmpzJztcbiAgc3RhcnRPcHRpb25zLndhdGNoID0gW1xuICAgICdzZXJ2aWNlL2RlbW9uLnRzJyxcbiAgICAnaXBjL1NlcnZlci50cycsXG4gICAgJ2lwYy9TZXJpYWxUZWUudHMnLFxuICAgICdzZXJ2aWNlL2RldGVjdG9yLnRzJyxcbiAgXTtcbn1cblxuY29uc3Qgc3RhcnR1cCA9IChwbGF0Zm9ybTogYW55KSA9PiBuZXcgUHJvbWlzZSgoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QobmV3IEVycm9yKCdUaW1lb3V0JykpLCAxMDAwMCk7XG4gIHBtMi5zdGFydHVwKHBsYXRmb3JtLCAoZXJyKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoZXJyKTtcbiAgICByZXNvbHZlKCk7XG4gIH0pO1xufSkpO1xuXG5jb25zdCBzdGFydENvbW1hbmQ6IENvbW1hbmRNb2R1bGUgPSB7XG4gIGNvbW1hbmQ6ICdzdGFydCcsXG4gIGRlc2NyaWJlOiAn0LfQsNC/0YPRgdGC0LjRgtGMINGB0LXRgNCy0LjRgSBOaUJVUycsXG4gIGJ1aWxkZXI6IGFyZ3YgPT4gYXJndlxuICAgIC5vcHRpb24oJ2F1dG8nLCB7XG4gICAgICBkZXNjcmliZTogJ9Cw0LLRgtC+0LfQsNC/0YPRgdC6INGB0LXRgNCy0LjRgdCwINC/0L7RgdC70LUg0YHRgtCw0YDRgtCwINGB0YLQuNGB0YLQtdC80Ysg0LTQu9GPINC30LDQtNCw0L3QvdC+0Lkg0J7QoScsXG4gICAgICBjaG9pY2VzOiBbJ3VidW50dScsICdjZW50b3MnLCAncmVkaGF0JywgJ2dlbnRvbycsICdzeXN0ZW1kJywgJ2RhcndpbicsICdhbWF6b24nXSxcbiAgICB9KSxcbiAgaGFuZGxlcjogKGFyZ2MpID0+IHtcbiAgICBwbTIuY29ubmVjdCgoZXJyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ9C90LUg0YPQtNCw0LvQvtGB0Ywg0L/QvtC00LrQu9GO0YfQuNGC0YzRgdGPINC6IHBtMicsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDIpO1xuICAgICAgfVxuICAgICAgZGVidWcoJ3BtMiBpcyBjb25uZWN0ZWQnKTtcbiAgICAgIHBtMi5kZWxldGUoc3RhcnRPcHRpb25zLm5hbWUhLCAoKSA9PlxuICAgICAgICBwbTIuc3RhcnQoc3RhcnRPcHRpb25zLCBhc3luYyAoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKCFlcnIgJiYgYXJnYy5hdXRvKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBhd2FpdCBzdGFydHVwKGFyZ2MuYXV0byBhcyBhbnkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfQndC1INGD0LTQsNC70L7RgdGMINC30LDRgNC10LPQtdGB0YLRgNC40YDQvtCy0LDRgtGMINGB0LXRgNCy0LjRgScsIGUubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHBtMi5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3Igd2hpbGUgc3RhcnQgbmlidXMuc2VydmljZScsIGVycik7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoMik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnNvbGUuaW5mbygnbmlidXMuc2VydmljZSDQt9Cw0L/Rg9GJ0LXQvScpO1xuICAgICAgICB9KSk7XG4gICAgfSk7XG4gIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBzdGFydENvbW1hbmQ7XG4iXX0=