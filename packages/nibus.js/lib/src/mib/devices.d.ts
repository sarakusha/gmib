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
declare type Listener<T> = (arg: T) => void;
declare type ChangedArg = {
    id: number;
    names: string[];
};
declare type ChangedListener = Listener<ChangedArg>;
declare type UploadStartArg = {
    domain: string;
    domainSize: number;
    offset: number;
    size: number;
};
declare type UploadStartListener = Listener<UploadStartArg>;
declare type UploadDataArg = {
    domain: string;
    data: Buffer;
    pos: number;
};
export declare type UploadDataListener = Listener<UploadDataArg>;
declare type UploadFinishArg = {
    domain: string;
    offset: number;
    data: Buffer;
};
declare type UploadFinishListener = Listener<UploadFinishArg>;
declare type DownloadStartArg = {
    domain: string;
    domainSize: number;
    offset: number;
    size: number;
};
declare type DownloadStartListener = Listener<DownloadStartArg>;
declare type DownloadDataArg = {
    domain: string;
    length: number;
};
export declare type DownloadDataListener = Listener<DownloadDataArg>;
declare type DownloadFinishArg = {
    domain: string;
    offset: number;
    size: number;
};
declare type DownloadFinishListener = Listener<DownloadFinishArg>;
export interface IDevice {
    readonly address: Address;
    drain(): Promise<number[]>;
    write(...ids: number[]): Promise<number[]>;
    read(...ids: number[]): Promise<{
        [name: string]: any;
    }>;
    upload(domain: string, offset?: number, size?: number): Promise<Uint8Array>;
    connection?: NibusConnection;
    release(): number;
    getId(idOrName: string | number): number;
    getName(idOrName: string | number): string;
    getRawValue(idOrName: number | string): any;
    getError(idOrName: number | string): any;
    [mibProperty: string]: any;
    on(event: 'connected' | 'disconnected', listener: () => void): this;
    on(event: 'changing' | 'changed', listener: ChangedListener): this;
    on(event: 'uploadStart', listener: UploadStartListener): this;
    on(event: 'uploadData', listener: UploadDataListener): this;
    on(event: 'uploadFinish', listener: UploadFinishListener): this;
    on(event: 'downloadStart', listener: DownloadStartListener): this;
    on(event: 'downloadData', listener: DownloadDataListener): this;
    on(event: 'downloadFinish', listener: DownloadFinishListener): this;
    once(event: 'connected' | 'disconnected', listener: () => void): this;
    once(event: 'changing' | 'changed', listener: ChangedListener): this;
    once(event: 'uploadStart', listener: UploadStartListener): this;
    once(event: 'uploadData', listener: UploadDataListener): this;
    once(event: 'uploadFinish', listener: UploadFinishListener): this;
    once(event: 'downloadStart', listener: DownloadStartListener): this;
    once(event: 'downloadData', listener: DownloadDataListener): this;
    once(event: 'downloadFinish', listener: DownloadFinishListener): this;
    addListener(event: 'connected' | 'disconnected', listener: () => void): this;
    addListener(event: 'changing' | 'changed', listener: ChangedListener): this;
    addListener(event: 'uploadStart', listener: UploadStartListener): this;
    addListener(event: 'uploadData', listener: UploadDataListener): this;
    addListener(event: 'uploadFinish', listener: UploadFinishListener): this;
    addListener(event: 'downloadStart', listener: DownloadStartListener): this;
    addListener(event: 'downloadData', listener: DownloadDataListener): this;
    addListener(event: 'downloadFinish', listener: DownloadFinishListener): this;
    off(event: 'connected' | 'disconnected', listener: () => void): this;
    off(event: 'changing' | 'changed', listener: ChangedListener): this;
    off(event: 'uploadStart', listener: UploadStartListener): this;
    off(event: 'uploadData', listener: UploadDataListener): this;
    off(event: 'uploadFinish', listener: UploadFinishListener): this;
    off(event: 'downloadStart', listener: DownloadStartListener): this;
    off(event: 'downloadData', listener: DownloadDataListener): this;
    off(event: 'downloadFinish', listener: DownloadFinishListener): this;
    removeListener(event: 'connected' | 'disconnected', listener: () => void): this;
    removeListener(event: 'changing' | 'changed', listener: ChangedListener): this;
    removeListener(event: 'uploadStart', listener: UploadStartListener): this;
    removeListener(event: 'uploadData', listener: UploadDataListener): this;
    removeListener(event: 'uploadFinish', listener: UploadFinishListener): this;
    removeListener(event: 'downloadStart', listener: DownloadStartListener): this;
    removeListener(event: 'downloadData', listener: DownloadDataListener): this;
    removeListener(event: 'downloadFinish', listener: DownloadFinishListener): this;
    emit(event: 'connected' | 'disconnected'): boolean;
    emit(event: 'changing' | 'changed', arg: ChangedArg): boolean;
    emit(event: 'uploadStart', arg: UploadStartArg): boolean;
    emit(event: 'uploadData', arg: UploadDataArg): boolean;
    emit(event: 'uploadFinish', arg: UploadFinishArg): boolean;
    emit(event: 'downloadStart', arg: DownloadStartArg): boolean;
    emit(event: 'downloadData', arg: DownloadDataArg): boolean;
    emit(event: 'downloadFinish', arg: DownloadFinishArg): boolean;
}
export declare function getMibFile(mibname: string): string;
declare interface Devices {
    on(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
    once(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
    addListener(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
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