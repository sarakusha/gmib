"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimeoutError = exports.NibusError = exports.MibError = void 0;

require("source-map-support/register");

var _Address = _interopRequireDefault(require("./Address"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
class MibError extends Error {}

exports.MibError = MibError;

const getErrMsg = (errcode, prototype) => {
  const errEnum = Reflect.getMetadata('errorType', prototype);
  return errEnum && errEnum[errcode] && errEnum[errcode].annotation || `NiBUS error ${errcode}`;
};

class NibusError extends Error {
  constructor(errcode, prototype, msg) {
    super(`${msg ? `${msg}: ` : ''}${getErrMsg(errcode, prototype)}`);
    this.errcode = errcode;
  }

}

exports.NibusError = NibusError;

class TimeoutError extends Error {
  constructor(param) {
    const defaultMsg = 'Timeout error';
    const msg = param instanceof _Address.default ? `${defaultMsg} on ${param}` : param || defaultMsg;
    super(msg);
  }

}

exports.TimeoutError = TimeoutError;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9lcnJvcnMudHMiXSwibmFtZXMiOlsiTWliRXJyb3IiLCJFcnJvciIsImdldEVyck1zZyIsImVycmNvZGUiLCJwcm90b3R5cGUiLCJlcnJFbnVtIiwiUmVmbGVjdCIsImdldE1ldGFkYXRhIiwiYW5ub3RhdGlvbiIsIk5pYnVzRXJyb3IiLCJjb25zdHJ1Y3RvciIsIm1zZyIsIlRpbWVvdXRFcnJvciIsInBhcmFtIiwiZGVmYXVsdE1zZyIsIkFkZHJlc3MiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOzs7O0FBVkE7Ozs7Ozs7OztBQVlPLE1BQU1BLFFBQU4sU0FBdUJDLEtBQXZCLENBQTZCOzs7O0FBR3BDLE1BQU1DLFNBQVMsR0FBRyxDQUFDQyxPQUFELEVBQWtCQyxTQUFsQixLQUF3QztBQUN4RCxRQUFNQyxPQUFPLEdBQUdDLE9BQU8sQ0FBQ0MsV0FBUixDQUFvQixXQUFwQixFQUFpQ0gsU0FBakMsQ0FBaEI7QUFDQSxTQUFPQyxPQUFPLElBQUlBLE9BQU8sQ0FBQ0YsT0FBRCxDQUFsQixJQUErQkUsT0FBTyxDQUFDRixPQUFELENBQVAsQ0FBaUJLLFVBQWhELElBQStELGVBQWNMLE9BQVEsRUFBNUY7QUFDRCxDQUhEOztBQUtPLE1BQU1NLFVBQU4sU0FBeUJSLEtBQXpCLENBQStCO0FBQ3BDUyxFQUFBQSxXQUFXLENBQVFQLE9BQVIsRUFBeUJDLFNBQXpCLEVBQTRDTyxHQUE1QyxFQUEwRDtBQUNuRSxVQUFPLEdBQUVBLEdBQUcsR0FBSSxHQUFFQSxHQUFJLElBQVYsR0FBZ0IsRUFBRyxHQUFFVCxTQUFTLENBQUNDLE9BQUQsRUFBVUMsU0FBVixDQUFxQixFQUEvRDtBQURtRTtBQUVwRTs7QUFIbUM7Ozs7QUFNL0IsTUFBTVEsWUFBTixTQUEyQlgsS0FBM0IsQ0FBaUM7QUFHdENTLEVBQUFBLFdBQVcsQ0FBQ0csS0FBRCxFQUFhO0FBQ3RCLFVBQU1DLFVBQVUsR0FBRyxlQUFuQjtBQUNBLFVBQU1ILEdBQUcsR0FBR0UsS0FBSyxZQUFZRSxnQkFBakIsR0FBNEIsR0FBRUQsVUFBVyxPQUFNRCxLQUFNLEVBQXJELEdBQXlEQSxLQUFLLElBQUlDLFVBQTlFO0FBQ0EsVUFBTUgsR0FBTjtBQUNEOztBQVBxQyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuaW1wb3J0IEFkZHJlc3MgZnJvbSAnLi9BZGRyZXNzJztcblxuZXhwb3J0IGNsYXNzIE1pYkVycm9yIGV4dGVuZHMgRXJyb3Ige1xufVxuXG5jb25zdCBnZXRFcnJNc2cgPSAoZXJyY29kZTogbnVtYmVyLCBwcm90b3R5cGU6IG9iamVjdCkgPT4ge1xuICBjb25zdCBlcnJFbnVtID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnZXJyb3JUeXBlJywgcHJvdG90eXBlKTtcbiAgcmV0dXJuIGVyckVudW0gJiYgZXJyRW51bVtlcnJjb2RlXSAmJiBlcnJFbnVtW2VycmNvZGVdLmFubm90YXRpb24gfHwgYE5pQlVTIGVycm9yICR7ZXJyY29kZX1gO1xufTtcblxuZXhwb3J0IGNsYXNzIE5pYnVzRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlcnJjb2RlOiBudW1iZXIsIHByb3RvdHlwZTogb2JqZWN0LCBtc2c/OiBzdHJpbmcpIHtcbiAgICBzdXBlcihgJHttc2cgPyBgJHttc2d9OiBgIDogJyd9JHtnZXRFcnJNc2coZXJyY29kZSwgcHJvdG90eXBlKX1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGltZW91dEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhZGRyZXNzOiBBZGRyZXNzKTtcbiAgY29uc3RydWN0b3IobXNnPzogc3RyaW5nKTtcbiAgY29uc3RydWN0b3IocGFyYW06IGFueSkge1xuICAgIGNvbnN0IGRlZmF1bHRNc2cgPSAnVGltZW91dCBlcnJvcic7XG4gICAgY29uc3QgbXNnID0gcGFyYW0gaW5zdGFuY2VvZiBBZGRyZXNzID8gYCR7ZGVmYXVsdE1zZ30gb24gJHtwYXJhbX1gIDogcGFyYW0gfHwgZGVmYXVsdE1zZztcbiAgICBzdXBlcihtc2cpO1xuICB9XG59XG4iXX0=