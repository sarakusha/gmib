/// <reference types="node" />
import { INibusCommon, INibusDatagramJSON, NibusDatagram } from '../nibus';
import NmsServiceType from './NmsServiceType';
export interface INmsOptions extends INibusCommon {
    id: number;
    service: NmsServiceType;
    nms?: Buffer;
    isResponse?: boolean;
    notReply?: boolean;
    status?: number;
}
export interface INmsDatagramJSON extends INibusDatagramJSON {
    protocol: string;
    data?: never;
    id: number;
    service: string;
    nms?: Buffer;
    isResponse?: boolean;
    notReply?: boolean;
    value?: string;
    valueType?: string;
    status?: number;
}
export default class NmsDatagram extends NibusDatagram implements INmsOptions {
    static isNmsFrame(frame: Buffer): boolean;
    readonly isResponse: boolean;
    readonly notReply: boolean;
    readonly service: number;
    readonly id: number;
    readonly nms: Buffer;
    constructor(frameOrOptions: Buffer | INmsOptions);
    readonly valueType: number | undefined;
    readonly status: number | undefined;
    readonly value: any;
    isResponseFor(req: NmsDatagram): boolean;
    toJSON(): INmsDatagramJSON;
}
//# sourceMappingURL=NmsDatagram.d.ts.map