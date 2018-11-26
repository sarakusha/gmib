/// <reference types="node" />
import { EventEmitter } from 'events';
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
import { NibusConnection } from '../nibus';
declare const $values: unique symbol;
declare const $errors: unique symbol;
declare const $dirties: unique symbol;
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
/**
 * @fires connected
 * @fires disconnected
 * @fires changed
 * @fires changing
 */
export interface IDevice {
    [$values]: {
        [id: number]: any;
    };
    [$errors]: {
        [id: number]: Error;
    };
    [$dirties]: {
        [id: number]: boolean;
    };
    readonly address: Address;
    drain(): Promise<number[]>;
    write(...ids: number[]): Promise<number[]>;
    read(...ids: number[]): Promise<any[]>;
    connection?: NibusConnection;
    release(): number;
    [mibProperty: string]: any;
}
export declare function getMibFile(mibname: string): string;
/**
 * @fires new
 * @fires delete
 */
declare class Devices extends EventEmitter {
    get: () => IDevice[];
    create(address: AddressParam, mib?: string): IDevice;
}
declare const devices: Devices;
export default devices;
//# sourceMappingURL=devices.d.ts.map