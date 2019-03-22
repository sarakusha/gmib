import Address from './Address';
export declare class MibError extends Error {
}
export declare class NibusError extends Error {
    errcode: number;
    constructor(errcode: number, prototype: object, msg?: string);
}
export declare class TimeoutError extends Error {
    constructor(address: Address);
    constructor(msg?: string);
}
//# sourceMappingURL=errors.d.ts.map