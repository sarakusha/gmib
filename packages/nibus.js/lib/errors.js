"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimeoutError = exports.NibusError = exports.MibError = void 0;

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
  constructor(msg = 'Timeout error') {
    super(msg);
  }

}

exports.TimeoutError = TimeoutError;