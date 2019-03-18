import Address from './Address';

export class MibError extends Error {
}

const getErrMsg = (errcode: number, prototype: object) => {
  const errEnum = Reflect.getMetadata('errorType', prototype);
  return errEnum && errEnum[errcode] && errEnum[errcode].annotation || `NiBUS error ${errcode}`;
};

export class NibusError extends Error {
  constructor(public errcode: number, prototype: object, msg?: string) {
    super(`${msg ? `${msg}: ` : ''}${getErrMsg(errcode, prototype)}`);
  }
}

export class TimeoutError extends Error {
  constructor(address: Address);
  constructor(msg?: string);
  constructor(param: any) {
    const defaultMsg = 'Timeout error';
    const msg = param instanceof Address ? `${defaultMsg} on ${param}` : param || defaultMsg;
    super(msg);
  }
}
