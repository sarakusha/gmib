/// <reference types="node" />
import { EventEmitter } from 'events';
import { NmsDatagram } from '../nms';
import { IMibDescription } from '../service';
import NibusDatagram from './NibusDatagram';
export declare const MINIHOST_TYPE = 43974;
export declare type NibusBaudRate = 115200 | 57600 | 28800;
/**
 * @fires sarp
 * @fires data
 */
export default class NibusConnection extends EventEmitter {
    readonly port: string;
    readonly description: IMibDescription;
    private readonly serial;
    private readonly encoder;
    private readonly decoder;
    private ready;
    private closed;
    private readonly waited;
    private stopWaiting;
    private onDatagram;
    constructor(port: string, description: IMibDescription);
    sendDatagram(datagram: NibusDatagram): Promise<NmsDatagram | NmsDatagram[] | undefined>;
    findByType(type?: number): Promise<NmsDatagram | NmsDatagram[] | undefined>;
    close(callback?: (err?: Error) => void): void;
}
//# sourceMappingURL=NibusConnection.d.ts.map