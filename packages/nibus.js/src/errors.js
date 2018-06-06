export class NibusError extends Error {
  constructor(errcode, msg = 'Nibus error') {
    super(msg);
    this.errorcode = errcode;
  }

  updateErrorMessage(errEnum) {
    if (this.errcode && errEnum[this.errcode]) {
      this.message = errEnum[this.errcode];
    }
    return this.message;
  }
}

export class TimeoutError extends Error {
  constructor(msg = 'Timeout error') {
    super(msg);
  }
}

export class MibError extends Error {
}
