/// <reference types="node" />
export declare enum AddressType {
    broadcast = "broadcast",
    empty = "empty",
    mac = 0,
    net = 1,
    group = 2
}
export declare type AddressParam = string | Buffer | number[] | Uint8Array | Address;
export default class Address {
    private static autocount;
    static readonly empty: Address;
    static broadcast: Address;
    static toAddress(address?: AddressParam | null): Address | null | undefined;
    static read(type: AddressType, buffer: Buffer, offset?: number): Address;
    readonly type: AddressType;
    readonly domain?: number;
    readonly group?: number;
    readonly subnet?: number;
    readonly device?: number;
    readonly mac?: Buffer;
    readonly raw: Buffer;
    constructor(address?: AddressParam);
    readonly isEmpty: boolean;
    readonly isBroadcast: boolean;
    readonly rawType: number;
    toString(): string;
    equals(other?: string | number[] | Buffer | Address | null): boolean;
}
//# sourceMappingURL=Address.d.ts.map