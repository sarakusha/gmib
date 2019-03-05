/// <reference types="node" />
import { EventEmitter } from 'events';
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
import { NibusConnection } from '../nibus';
interface IMibPropertyAppInfo {
    nms_id: string | number;
    access: string;
    category?: string;
}
interface IMibProperty {
    type: string;
    annotation: string;
    appinfo: IMibPropertyAppInfo;
}
export interface IMibDeviceType {
    annotation: string;
    appinfo: {
        mib_vertsion: string;
        device_type: string;
        loader_type?: string;
        firmware?: string;
    };
    properties: {
        [key: string]: IMibProperty;
    };
}
export interface IMibType {
    base: string;
    appinfo?: {
        zero?: string;
        units?: string;
        precision?: string;
        representation?: string;
    };
    minInclusive?: string;
    maxInclusive?: string;
    enumeration?: {
        [key: string]: {
            annotation: string;
        };
    };
}
export interface IDevice extends EventEmitter {
    readonly address: Address;
    drain(): Promise<number[]>;
    write(...ids: number[]): Promise<number[]>;
    read(...ids: number[]): Promise<{
        [name: string]: any;
    }>;
    connection?: NibusConnection;
    release(): number;
    getId(idOrName: string | number): number;
    getName(idOrName: string | number): string;
    getRawValue(idOrName: number | string): any;
    getError(idOrName: number | string): any;
    [mibProperty: string]: any;
}
export declare function getMibFile(mibname: string): string;
declare interface Devices {
    on(event: 'new', deviceListener: (device: IDevice) => void): this;
    once(event: 'new', deviceListener: (device: IDevice) => void): this;
    addEventListener(event: 'new', deviceListener: (device: IDevice) => void): this;
    on(event: 'delete', deviceListener: (device: IDevice) => void): this;
    once(event: 'delete', deviceListener: (device: IDevice) => void): this;
    addEventListener(event: 'delete', deviceListener: (device: IDevice) => void): this;
}
export declare function getMibPrototype(mib: string): Object;
declare class Devices extends EventEmitter {
    get: () => IDevice[];
    find: (address: AddressParam) => IDevice | undefined;
    create(address: AddressParam, mib: string): IDevice;
    create(address: AddressParam, type: number): IDevice;
}
declare const devices: Devices;
export default devices;
//# sourceMappingURL=devices.d.ts.map