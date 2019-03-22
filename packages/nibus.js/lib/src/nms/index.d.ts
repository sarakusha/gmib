/// <reference types="node" />
import { AddressParam } from '../Address';
import { getNmsType } from './nms';
import NmsDatagram from './NmsDatagram';
import NmsServiceType from './NmsServiceType';
import NmsValueType from './NmsValueType';
export { NmsServiceType };
export { NmsValueType };
export { NmsDatagram };
export { getNmsType };
export declare function createNmsRead(destination: AddressParam, ...ids: number[]): NmsDatagram;
export declare function createNmsWrite(destination: AddressParam, id: number, type: NmsValueType, value: any, notReply?: boolean): NmsDatagram;
export declare function createNmsInitiateUploadSequence(destination: AddressParam, id: number): NmsDatagram;
export declare function createNmsRequestDomainUpload(destination: AddressParam, domain: string): NmsDatagram;
export declare function createNmsUploadSegment(destination: AddressParam, id: number, offset: number, length: number): NmsDatagram;
export declare function createNmsRequestDomainDownload(destination: AddressParam, domain: string): NmsDatagram;
export declare function createNmsInitiateDownloadSequence(destination: AddressParam, id: number): NmsDatagram;
export declare function createNmsDownloadSegment(destination: AddressParam, id: number, offset: number, data: Buffer): NmsDatagram;
export declare function createNmsTerminateDownloadSequence(destination: AddressParam, id: number): NmsDatagram;
export declare function createNmsVerifyDomainChecksum(destination: AddressParam, id: number, offset: number, size: number, crc: number): NmsDatagram;
export declare type TypedValue = [NmsValueType, any];
export declare function createExecuteProgramInvocation(destination: AddressParam, id: number, notReply?: boolean, ...args: TypedValue[]): NmsDatagram;
//# sourceMappingURL=index.d.ts.map