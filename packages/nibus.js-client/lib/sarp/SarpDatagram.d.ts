/// <reference types="node" />
import { NibusDatagram, INibusCommon } from '../nibus';
import SarpQueryType from './SarpQueryType';
export interface ISarpOptions extends INibusCommon {
    isResponse?: boolean;
    queryType: SarpQueryType;
    queryParam: Buffer;
    mac?: Buffer;
}
export default class SarpDatagram extends NibusDatagram implements ISarpOptions {
    static isSarpFrame(frame: Buffer): boolean;
    readonly isResponse: boolean;
    readonly queryType: SarpQueryType;
    readonly queryParam: Buffer;
    readonly mac: Buffer;
    constructor(frameOrOptions: ISarpOptions | Buffer);
    readonly deviceType: number | undefined;
}
//# sourceMappingURL=SarpDatagram.d.ts.map