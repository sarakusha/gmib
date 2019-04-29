/// <reference types="node" />
import { EventEmitter } from 'events';
import * as t from 'io-ts';
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
import { NibusConnection } from '../nibus';
import NmsDatagram from '../nms/NmsDatagram';
declare const MibDeviceTypeV: t.TypeC<{
    annotation: t.StringC;
    appinfo: t.IntersectionC<[t.TypeC<{
        mib_version: t.StringC;
    }>, t.PartialC<{
        device_type: t.StringC;
        loader_type: t.StringC;
        firmware: t.StringC;
        min_version: t.StringC;
    }>]>;
    properties: t.RecordC<t.StringC, t.TypeC<{
        type: t.StringC;
        annotation: t.StringC;
        appinfo: t.IntersectionC<[t.TypeC<{
            nms_id: t.UnionC<[t.StringC, t.BrandC<t.NumberC, t.IntBrand>]>;
            access: t.StringC;
        }>, t.PartialC<{
            category: t.StringC;
        }>]>;
    }>>;
}>;
export interface IMibDeviceType extends t.TypeOf<typeof MibDeviceTypeV> {
}
declare const MibTypeV: t.IntersectionC<[t.TypeC<{
    base: t.StringC;
}>, t.PartialC<{
    appinfo: t.PartialC<{
        zero: t.StringC;
        units: t.StringC;
        precision: t.StringC;
        representation: t.StringC;
    }>;
    minInclusive: t.StringC;
    maxInclusive: t.StringC;
    enumeration: t.RecordC<t.StringC, t.TypeC<{
        annotation: t.StringC;
    }>>;
}>]>;
export interface IMibType extends t.TypeOf<typeof MibTypeV> {
}
export declare const MibDeviceV: t.IntersectionC<[t.TypeC<{
    device: t.StringC;
    types: t.RecordC<t.StringC, t.UnionC<[t.TypeC<{
        annotation: t.StringC;
        appinfo: t.IntersectionC<[t.TypeC<{
            mib_version: t.StringC;
        }>, t.PartialC<{
            device_type: t.StringC;
            loader_type: t.StringC;
            firmware: t.StringC;
            min_version: t.StringC;
        }>]>;
        properties: t.RecordC<t.StringC, t.TypeC<{
            type: t.StringC;
            annotation: t.StringC;
            appinfo: t.IntersectionC<[t.TypeC<{
                nms_id: t.UnionC<[t.StringC, t.BrandC<t.NumberC, t.IntBrand>]>;
                access: t.StringC;
            }>, t.PartialC<{
                category: t.StringC;
            }>]>;
        }>>;
    }>, t.IntersectionC<[t.TypeC<{
        base: t.StringC;
    }>, t.PartialC<{
        appinfo: t.PartialC<{
            zero: t.StringC;
            units: t.StringC;
            precision: t.StringC;
            representation: t.StringC;
        }>;
        minInclusive: t.StringC;
        maxInclusive: t.StringC;
        enumeration: t.RecordC<t.StringC, t.TypeC<{
            annotation: t.StringC;
        }>>;
    }>]>, t.TypeC<{
        annotation: t.StringC;
        properties: t.TypeC<{
            id: t.TypeC<{
                type: t.LiteralC<"xs:unsignedShort">;
                annotation: t.StringC;
            }>;
        }>;
    }>]>>;
}>, t.PartialC<{
    subroutines: t.RecordC<t.StringC, t.IntersectionC<[t.TypeC<{
        annotation: t.StringC;
        appinfo: t.IntersectionC<[t.TypeC<{
            nms_id: t.UnionC<[t.StringC, t.BrandC<t.NumberC, t.IntBrand>]>;
        }>, t.PartialC<{
            response: t.StringC;
        }>]>;
    }>, t.PartialC<{
        properties: t.RecordC<t.StringC, t.TypeC<{
            type: t.StringC;
            annotation: t.StringC;
        }>>;
    }>]>>;
}>]>;
declare type Listener<T> = (arg: T) => void;
declare type ChangeArg = {
    id: number;
    names: string[];
};
export declare type ChangeListener = Listener<ChangeArg>;
declare type UploadStartArg = {
    domain: string;
    domainSize: number;
    offset: number;
    size: number;
};
export declare type UploadStartListener = Listener<UploadStartArg>;
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
export declare type UploadFinishListener = Listener<UploadFinishArg>;
declare type DownloadStartArg = {
    domain: string;
    domainSize: number;
    offset: number;
    size: number;
};
export declare type DownloadStartListener = Listener<DownloadStartArg>;
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
export declare type DownloadFinishListener = Listener<DownloadFinishArg>;
export declare type DeviceId = string & {
    __brand: 'DeviceId';
};
export interface IDevice {
    readonly id: DeviceId;
    readonly address: Address;
    drain(): Promise<number[]>;
    write(...ids: number[]): Promise<number[]>;
    read(...ids: number[]): Promise<{
        [name: string]: any;
    }>;
    upload(domain: string, offset?: number, size?: number): Promise<Buffer>;
    download(domain: string, data: Buffer, offset?: number, noTerm?: boolean): Promise<void>;
    execute(program: string, args?: Record<string, any>): Promise<NmsDatagram | NmsDatagram[] | undefined>;
    connection?: NibusConnection;
    release(): number;
    getId(idOrName: string | number): number;
    getName(idOrName: string | number): string;
    getRawValue(idOrName: number | string): any;
    getError(idOrName: number | string): any;
    isDirty(idOrName: string | number): boolean;
    [mibProperty: string]: any;
    on(event: 'connected' | 'disconnected', listener: () => void): this;
    on(event: 'changing' | 'changed', listener: ChangeListener): this;
    on(event: 'uploadStart', listener: UploadStartListener): this;
    on(event: 'uploadData', listener: UploadDataListener): this;
    on(event: 'uploadFinish', listener: UploadFinishListener): this;
    on(event: 'downloadStart', listener: DownloadStartListener): this;
    on(event: 'downloadData', listener: DownloadDataListener): this;
    on(event: 'downloadFinish', listener: DownloadFinishListener): this;
    once(event: 'connected' | 'disconnected', listener: () => void): this;
    once(event: 'changing' | 'changed', listener: ChangeListener): this;
    once(event: 'uploadStart', listener: UploadStartListener): this;
    once(event: 'uploadData', listener: UploadDataListener): this;
    once(event: 'uploadFinish', listener: UploadFinishListener): this;
    once(event: 'downloadStart', listener: DownloadStartListener): this;
    once(event: 'downloadData', listener: DownloadDataListener): this;
    once(event: 'downloadFinish', listener: DownloadFinishListener): this;
    addListener(event: 'connected' | 'disconnected', listener: () => void): this;
    addListener(event: 'changing' | 'changed', listener: ChangeListener): this;
    addListener(event: 'uploadStart', listener: UploadStartListener): this;
    addListener(event: 'uploadData', listener: UploadDataListener): this;
    addListener(event: 'uploadFinish', listener: UploadFinishListener): this;
    addListener(event: 'downloadStart', listener: DownloadStartListener): this;
    addListener(event: 'downloadData', listener: DownloadDataListener): this;
    addListener(event: 'downloadFinish', listener: DownloadFinishListener): this;
    off(event: 'connected' | 'disconnected', listener: () => void): this;
    off(event: 'changing' | 'changed', listener: ChangeListener): this;
    off(event: 'uploadStart', listener: UploadStartListener): this;
    off(event: 'uploadData', listener: UploadDataListener): this;
    off(event: 'uploadFinish', listener: UploadFinishListener): this;
    off(event: 'downloadStart', listener: DownloadStartListener): this;
    off(event: 'downloadData', listener: DownloadDataListener): this;
    off(event: 'downloadFinish', listener: DownloadFinishListener): this;
    removeListener(event: 'connected' | 'disconnected', listener: () => void): this;
    removeListener(event: 'changing' | 'changed', listener: ChangeListener): this;
    removeListener(event: 'uploadStart', listener: UploadStartListener): this;
    removeListener(event: 'uploadData', listener: UploadDataListener): this;
    removeListener(event: 'uploadFinish', listener: UploadFinishListener): this;
    removeListener(event: 'downloadStart', listener: DownloadStartListener): this;
    removeListener(event: 'downloadData', listener: DownloadDataListener): this;
    removeListener(event: 'downloadFinish', listener: DownloadFinishListener): this;
    emit(event: 'connected' | 'disconnected'): boolean;
    emit(event: 'changing' | 'changed', arg: ChangeArg): boolean;
    emit(event: 'uploadStart', arg: UploadStartArg): boolean;
    emit(event: 'uploadData', arg: UploadDataArg): boolean;
    emit(event: 'uploadFinish', arg: UploadFinishArg): boolean;
    emit(event: 'downloadStart', arg: DownloadStartArg): boolean;
    emit(event: 'downloadData', arg: DownloadDataArg): boolean;
    emit(event: 'downloadFinish', arg: DownloadFinishArg): boolean;
}
export declare function getMibFile(mibname: string): string;
export declare const getMibTypes: () => {
    [x: string]: ({
        mib: string;
    } & {
        minVersion?: number | undefined;
    })[];
} | undefined;
export declare function findMibByType(type: number, version?: number): string | undefined;
export declare interface Devices {
    on(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
    once(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
    addListener(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
    on(event: 'serno', listener: (prevAddress: Address, newAddress: Address) => void): this;
    once(event: 'serno', listener: (prevAddress: Address, newAddress: Address) => void): this;
    addListener(event: 'serno', listener: (prevAddress: Address, newAddress: Address) => void): this;
}
export declare function getMibPrototype(mib: string): Object;
export declare class Devices extends EventEmitter {
    get: () => IDevice[];
    find: (address: AddressParam) => IDevice[] | undefined;
    create(address: AddressParam, mib: string): IDevice;
    create(address: AddressParam, type: number, version?: number): IDevice;
}
declare const devices: Devices;
export default devices;
//# sourceMappingURL=devices.d.ts.map