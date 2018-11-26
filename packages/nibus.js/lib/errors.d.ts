export declare class MibError extends Error {
}
export declare class NibusError extends Error {
    errcode: number;
    constructor(errcode: number, prototype: object);
}
export declare class TimeoutError extends Error {
    constructor(msg?: string);
}
//# sourceMappingURL=errors.d.ts.map