"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimeoutError = exports.NibusError = exports.MibError = void 0;

var _Address = _interopRequireDefault(require("./Address"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MibError extends Error {}

exports.MibError = MibError;

const getErrMsg = (errcode, prototype) => {
  const errEnum = Reflect.getMetadata('errorType', prototype);
  return errEnum && errEnum[errcode] && errEnum[errcode].annotation || `NiBUS error ${errcode}`;
};

class NibusError extends Error {
  constructor(errcode, prototype) {
    super(getErrMsg(errcode, prototype));
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