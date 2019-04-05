"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _pm = _interopRequireDefault(require("pm2"));

var _debug = _interopRequireDefault(require("debug"));

var _start = require("./start");

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
const debug = (0, _debug.default)('nibus:start');
const stopCommand = {
  command: 'stop',
  describe: 'остановить службу NiBUS',
  builder: {},
  handler: () => {
    _pm.default.connect(err => {
      if (err) {
        console.error('error while connect pm2', err.stack);

        _pm.default.disconnect();

        process.exit(2);
      }

      debug('pm2 is connected');

      _pm.default.delete(_start.startOptions.name, error => {
        if (error && error.message !== 'process name not found') {
          console.error('не удалось остановить сервис', error.message);
        } else {
          console.info('nibus.service остановлен');
        }

        _pm.default.disconnect();
      });
    });
  }
};
var _default = stopCommand;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvY29tbWFuZHMvc3RvcC50cyJdLCJuYW1lcyI6WyJkZWJ1ZyIsInN0b3BDb21tYW5kIiwiY29tbWFuZCIsImRlc2NyaWJlIiwiYnVpbGRlciIsImhhbmRsZXIiLCJwbTIiLCJjb25uZWN0IiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwic3RhY2siLCJkaXNjb25uZWN0IiwicHJvY2VzcyIsImV4aXQiLCJkZWxldGUiLCJzdGFydE9wdGlvbnMiLCJuYW1lIiwibWVzc2FnZSIsImluZm8iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUVBOztBQUVBOzs7O0FBZEE7Ozs7Ozs7OztBQWdCQSxNQUFNQSxLQUFLLEdBQUcsb0JBQWEsYUFBYixDQUFkO0FBQ0EsTUFBTUMsV0FBMEIsR0FBRztBQUNqQ0MsRUFBQUEsT0FBTyxFQUFFLE1BRHdCO0FBRWpDQyxFQUFBQSxRQUFRLEVBQUUseUJBRnVCO0FBR2pDQyxFQUFBQSxPQUFPLEVBQUUsRUFId0I7QUFJakNDLEVBQUFBLE9BQU8sRUFBRSxNQUFNO0FBQ2JDLGdCQUFJQyxPQUFKLENBQWFDLEdBQUQsSUFBUztBQUNuQixVQUFJQSxHQUFKLEVBQVM7QUFDUEMsUUFBQUEsT0FBTyxDQUFDQyxLQUFSLENBQWMseUJBQWQsRUFBeUNGLEdBQUcsQ0FBQ0csS0FBN0M7O0FBQ0FMLG9CQUFJTSxVQUFKOztBQUNBQyxRQUFBQSxPQUFPLENBQUNDLElBQVIsQ0FBYSxDQUFiO0FBQ0Q7O0FBQ0RkLE1BQUFBLEtBQUssQ0FBQyxrQkFBRCxDQUFMOztBQUNBTSxrQkFBSVMsTUFBSixDQUFXQyxvQkFBYUMsSUFBeEIsRUFBZ0NQLEtBQUQsSUFBVztBQUN4QyxZQUFJQSxLQUFLLElBQUlBLEtBQUssQ0FBQ1EsT0FBTixLQUFrQix3QkFBL0IsRUFBeUQ7QUFDdkRULFVBQUFBLE9BQU8sQ0FBQ0MsS0FBUixDQUFjLDhCQUFkLEVBQThDQSxLQUFLLENBQUNRLE9BQXBEO0FBQ0QsU0FGRCxNQUVPO0FBQ0xULFVBQUFBLE9BQU8sQ0FBQ1UsSUFBUixDQUFhLDBCQUFiO0FBQ0Q7O0FBQ0RiLG9CQUFJTSxVQUFKO0FBQ0QsT0FQRDtBQVFELEtBZkQ7QUFnQkQ7QUFyQmdDLENBQW5DO2VBd0JlWCxXIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBwbTIgZnJvbSAncG0yJztcbmltcG9ydCB7IENvbW1hbmRNb2R1bGUgfSBmcm9tICd5YXJncyc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcblxuaW1wb3J0IHsgc3RhcnRPcHRpb25zIH0gZnJvbSAnLi9zdGFydCc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpzdGFydCcpO1xuY29uc3Qgc3RvcENvbW1hbmQ6IENvbW1hbmRNb2R1bGUgPSB7XG4gIGNvbW1hbmQ6ICdzdG9wJyxcbiAgZGVzY3JpYmU6ICfQvtGB0YLQsNC90L7QstC40YLRjCDRgdC70YPQttCx0YMgTmlCVVMnLFxuICBidWlsZGVyOiB7fSxcbiAgaGFuZGxlcjogKCkgPT4ge1xuICAgIHBtMi5jb25uZWN0KChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3Igd2hpbGUgY29ubmVjdCBwbTInLCBlcnIuc3RhY2spO1xuICAgICAgICBwbTIuZGlzY29ubmVjdCgpO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMik7XG4gICAgICB9XG4gICAgICBkZWJ1ZygncG0yIGlzIGNvbm5lY3RlZCcpO1xuICAgICAgcG0yLmRlbGV0ZShzdGFydE9wdGlvbnMubmFtZSEsIChlcnJvcikgPT4ge1xuICAgICAgICBpZiAoZXJyb3IgJiYgZXJyb3IubWVzc2FnZSAhPT0gJ3Byb2Nlc3MgbmFtZSBub3QgZm91bmQnKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcign0L3QtSDRg9C00LDQu9C+0YHRjCDQvtGB0YLQsNC90L7QstC40YLRjCDRgdC10YDQstC40YEnLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ25pYnVzLnNlcnZpY2Ug0L7RgdGC0LDQvdC+0LLQu9C10L0nKTtcbiAgICAgICAgfVxuICAgICAgICBwbTIuZGlzY29ubmVjdCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBzdG9wQ29tbWFuZDtcbiJdfQ==