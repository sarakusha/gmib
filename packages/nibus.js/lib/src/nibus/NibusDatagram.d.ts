/// <reference types="node" />
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
export interface INibusCommon {
    destination: AddressParam;
    priority?: number;
    source?: AddressParam;
}
export declare enum Protocol {
    NMS = 1,
    SARP = 2
}
export interface INibusOptions extends INibusCommon {
    protocol: Protocol;
    data: Buffer;
}
export interface INibusDatagramJSON {
    priority: number;
    protocol: Protocol;
    destination: string;
    source: string;
    timeStamp: string;
    data?: Buffer;
}
export default class NibusDatagram implements INibusOptions {
    static defaultSource: AddressParam;
    readonly priority: number;
    readonly protocol: number;
    readonly destination: Address;
    readonly source: Address;
    readonly data: Buffer;
    readonly raw: Buffer;
    constructor(frameOrOptions: Buffer | INibusOptions);
    toJSON(): INibusDatagramJSON;
}
//# sourceMappingURL=NibusDatagram.d.ts.map