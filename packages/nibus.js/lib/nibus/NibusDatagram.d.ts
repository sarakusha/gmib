/// <reference types="node" />
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
export interface INibusCommon {
    destination: AddressParam;
    priority?: number;
    source?: AddressParam;
}
export interface INibusOptions extends INibusCommon {
    protocol: number;
    data: Buffer;
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
    toJSON(): any;
}
//# sourceMappingURL=NibusDatagram.d.ts.map