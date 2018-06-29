export class MibError extends Error {
}

export class NibusError extends Error {
  constructor(public errcode: number, msg = 'Nibus error') {
    super(msg);
  }

  public updateErrorMessage(errEnum: string[]) {
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
