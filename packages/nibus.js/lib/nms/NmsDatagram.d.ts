/// <reference types="node" />
import { NibusDatagram, INibusCommon } from '../nibus';
import NmsServiceType from './NmsServiceType';
export interface INmsOptions extends INibusCommon {
    id: number;
    service: NmsServiceType;
    nms?: Buffer;
    isResponse?: boolean;
    isResponsible?: boolean;
}
export default class NmsDatagram extends NibusDatagram implements INmsOptions {
    static isNmsFrame(frame: Buffer): boolean;
    readonly isResponse: boolean;
    readonly isResponsible: boolean;
    readonly service: number;
    readonly id: number;
    readonly nms: Buffer;
    constructor(frameOrOptions: Buffer | INmsOptions);
    readonly valueType: number | undefined;
    readonly status: number | undefined;
    readonly value: any;
    isResponseFor(req: NmsDatagram): boolean;
    toJSON(): any;
}
//# sourceMappingURL=NmsDatagram.d.ts.map