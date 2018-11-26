import { AddressParam } from '../Address';
import NmsDatagram from './NmsDatagram';
import { getNmsType } from './nms';
import NmsServiceType from './NmsServiceType';
import NmsValueType from './NmsValueType';
export { NmsServiceType };
export { NmsValueType };
export { NmsDatagram };
export { getNmsType };
export declare function createNmsRead(destination: AddressParam, ...ids: number[]): NmsDatagram;
export declare function createNmsWrite(destination: AddressParam, id: number, type: NmsValueType, value: any, isResponsible?: boolean): NmsDatagram;
export declare function createNmsInitiateUploadSequence(destination: AddressParam, id: number): NmsDatagram;
export declare function createNmsRequestDomainUpload(destination: AddressParam, domain: string): NmsDatagram;
export declare function createNmsUploadSegment(destination: AddressParam, id: number, offset: number, length: number): NmsDatagram;
//# sourceMappingURL=index.d.ts.map